using System.Text;
using System.Security.Cryptography;
using InvoiceLens.Application.Documents;
using InvoiceLens.Application.Invoices;
using InvoiceLens.Infrastructure.LocalInvoices;
using InvoiceLens.Infrastructure.OpenInvoice;
using InvoiceLens.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace InvoiceLens.Infrastructure.DocumentStreaming;

public class DocumentStreamService(
    IInvoiceQueries invoiceQueries,
    LocalInvoiceComparisonOptions localInvoiceOptions,
    IOpenInvoiceClient openInvoiceClient,
    ILogger<DocumentStreamService> logger) : IDocumentQueries
{
    public async Task<DocumentStreamResult?> GetSnapshotAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var detail = await invoiceQueries.GetDetailAsync(invoiceId, cancellationToken);
        if (detail is null || string.IsNullOrWhiteSpace(detail.InvoiceNumber))
        {
            return null;
        }

        // Serve the real saved PDF (named by invoice number) when it exists.
        var fileName = $"{Path.GetFileName(detail.InvoiceNumber)}.pdf";
        var pdfPath = ResolvePdfPath(fileName);

        if (!File.Exists(pdfPath))
        {
            return null;
        }

        var stream = new FileStream(pdfPath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return new DocumentStreamResult(fileName, "application/pdf", stream);
    }

    public async Task<DocumentStreamResult?> GetAttachmentAsync(Guid invoiceId, string attachmentId, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT TOP (1)
                COALESCE(ia.FileName, air.FileName, CONCAT('attachment-', @AttachmentId)) AS FileName,
                COALESCE(ia.ContentType, air.ContentType, 'application/octet-stream') AS ContentType,
                ia.StoragePath,
                i.OpenInvoiceDocumentId
            FROM dbo.Invoice i
            LEFT JOIN dbo.InvoiceAttachments ia
                ON ia.InvoiceId = i.InvoiceId
               AND ia.OpenInvoiceAttachmentId = @AttachmentId
            LEFT JOIN dbo.InvoiceAttachmentReference air
                ON air.InvoiceId = i.InvoiceId
               AND air.ExternalAttachmentId = @AttachmentId
            WHERE i.InvoiceId = @InvoiceId
            ORDER BY ia.CreatedAtUtc DESC, air.CreatedAtUtc DESC;
            """;
        command.Parameters.AddWithValue("@InvoiceId", invoiceId);
        command.Parameters.AddWithValue("@AttachmentId", attachmentId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (await reader.ReadAsync(cancellationToken))
        {
            var fileName = reader["FileName"] as string ?? $"attachment-{attachmentId}";
            var contentType = reader["ContentType"] as string;
            var storagePath = reader["StoragePath"] as string;
            var openInvoiceDocumentId = reader["OpenInvoiceDocumentId"] as string;

            if (!string.IsNullOrWhiteSpace(storagePath) &&
                !storagePath.StartsWith("legacy://", StringComparison.OrdinalIgnoreCase) &&
                File.Exists(storagePath))
            {
                var stream = new FileStream(storagePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                return new DocumentStreamResult(
                    fileName,
                    string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
                    stream);
            }

            var legacyFilePath = ResolvePdfPath(Path.GetFileName(fileName));
            if (File.Exists(legacyFilePath))
            {
                var legacyStream = new FileStream(legacyFilePath, FileMode.Open, FileAccess.Read, FileShare.Read);
                return new DocumentStreamResult(
                    Path.GetFileName(fileName),
                    string.IsNullOrWhiteSpace(contentType) ? "application/pdf" : contentType,
                    legacyStream);
            }

            if (!string.IsNullOrWhiteSpace(openInvoiceDocumentId))
            {
                try
                {
                    using var response = await openInvoiceClient.GetInvoiceAttachmentAsync(openInvoiceDocumentId, attachmentId, cancellationToken);
                    if (response.IsSuccessStatusCode)
                    {
                        var bytes = await response.Content.ReadAsByteArrayAsync(cancellationToken);
                        if (bytes.Length > 0)
                        {
                            var fetchedContentType = response.Content.Headers.ContentType?.MediaType;
                            var resolvedContentType = string.IsNullOrWhiteSpace(fetchedContentType)
                                ? (string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType)
                                : fetchedContentType;

                            var hydratedStoragePath = await WriteHydratedAttachmentAsync(attachmentId, fileName, bytes, cancellationToken);
                            await SaveHydratedAttachmentMetadataAsync(
                                connection,
                                invoiceId,
                                attachmentId,
                                fileName,
                                resolvedContentType,
                                hydratedStoragePath,
                                bytes.LongLength,
                                bytes,
                                cancellationToken);

                            return new DocumentStreamResult(
                                fileName,
                                resolvedContentType,
                                new MemoryStream(bytes));
                        }
                    }
                    else
                    {
                        logger.LogWarning("OpenInvoice attachment fetch failed for InvoiceId={InvoiceId}, OpenInvoiceDocumentId={OpenInvoiceDocumentId}, AttachmentId={AttachmentId}, Status={StatusCode}", invoiceId, openInvoiceDocumentId, attachmentId, (int)response.StatusCode);
                    }
                }
                catch (Exception exception)
                {
                    logger.LogWarning(exception, "OpenInvoice attachment hydration failed for InvoiceId={InvoiceId}, OpenInvoiceDocumentId={OpenInvoiceDocumentId}, AttachmentId={AttachmentId}", invoiceId, openInvoiceDocumentId, attachmentId);
                }
            }

            return null;
        }

        return null;
    }

    private string ResolvePdfPath(string fileName)
    {
        var root = ResolveWorkspaceRoot();
        var pdfFolder = Path.IsPathRooted(localInvoiceOptions.PdfFolder)
            ? localInvoiceOptions.PdfFolder
            : Path.GetFullPath(Path.Combine(root, localInvoiceOptions.PdfFolder));
        return Path.Combine(pdfFolder, fileName);
    }

    private static string ResolveWorkspaceRoot()
    {
        var candidates = new[]
        {
            AppContext.BaseDirectory,
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..")),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
        };

        foreach (var candidate in candidates)
        {
            if (File.Exists(Path.Combine(candidate, ".env")) || Directory.Exists(Path.Combine(candidate, "samples")))
            {
                return candidate;
            }
        }

        return Directory.GetCurrentDirectory();
    }

    private async Task<string> WriteHydratedAttachmentAsync(string attachmentId, string fileName, byte[] bytes, CancellationToken cancellationToken)
    {
        var root = ResolveWorkspaceRoot();
        var directory = Path.Combine(root, "tmp", "openinvoice-hydrated-attachments");
        Directory.CreateDirectory(directory);

        var safeFileName = string.Join("_", Path.GetFileName(fileName).Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
        var path = Path.Combine(directory, $"{attachmentId}-{safeFileName}");

        await File.WriteAllBytesAsync(path, bytes, cancellationToken);
        return path;
    }

    private static async Task SaveHydratedAttachmentMetadataAsync(
        SqlConnection connection,
        Guid invoiceId,
        string attachmentId,
        string fileName,
        string contentType,
        string storagePath,
        long sizeBytes,
        byte[] bodyBytes,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            IF EXISTS (
                SELECT 1
                FROM dbo.InvoiceAttachments
                WHERE InvoiceId = @InvoiceId
                  AND OpenInvoiceAttachmentId = @AttachmentId
            )
            BEGIN
                UPDATE dbo.InvoiceAttachments
                SET FileName = @FileName,
                    ContentType = @ContentType,
                    SizeBytes = @SizeBytes,
                    StoragePath = @StoragePath,
                    BodyHash = @BodyHash,
                    DocumentUrl = CONCAT('/api/invoices/', CONVERT(NVARCHAR(36), @InvoiceId), '/attachments/', @AttachmentId)
                WHERE InvoiceId = @InvoiceId
                  AND OpenInvoiceAttachmentId = @AttachmentId;
            END
            ELSE
            BEGIN
                INSERT INTO dbo.InvoiceAttachments
                    (Id, InvoiceId, OpenInvoiceAttachmentId, FileName, ContentType, SizeBytes, StoragePath, DocumentUrl, BodyHash, CreatedAtUtc)
                VALUES
                    (NEWID(), @InvoiceId, @AttachmentId, @FileName, @ContentType, @SizeBytes, @StoragePath, CONCAT('/api/invoices/', CONVERT(NVARCHAR(36), @InvoiceId), '/attachments/', @AttachmentId), @BodyHash, SYSUTCDATETIME());
            END
            """;
        command.Parameters.AddWithValue("@InvoiceId", invoiceId);
        command.Parameters.AddWithValue("@AttachmentId", attachmentId);
        command.Parameters.AddWithValue("@FileName", fileName);
        command.Parameters.AddWithValue("@ContentType", contentType);
        command.Parameters.AddWithValue("@SizeBytes", sizeBytes);
        command.Parameters.AddWithValue("@StoragePath", storagePath);
        command.Parameters.AddWithValue("@BodyHash", Convert.ToBase64String(SHA256.HashData(bodyBytes)));

        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
