using System.Text;
using System.Security.Cryptography;
using InvoiceLens.Application.Documents;
using InvoiceLens.Application.Invoices;
using InvoiceLens.Infrastructure.LocalInvoices;
using InvoiceLens.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace InvoiceLens.Infrastructure.DocumentStreaming;

public class DocumentStreamService(
    IInvoiceQueries invoiceQueries,
    LocalInvoiceComparisonOptions localInvoiceOptions,
    ILogger<DocumentStreamService> logger) : IDocumentQueries
{
    public async Task<DocumentStreamResult?> GetSnapshotAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        await using (var connection = SqlConnectionFactory.CreateConnection())
        {
            await connection.OpenAsync(cancellationToken);
            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT TOP (1)
                    invoice.InvoiceNumber,
                    snapshot.StoragePath,
                    snapshot.ContentType
                FROM dbo.InvoiceSnapshots snapshot
                INNER JOIN dbo.Invoice invoice ON invoice.InvoiceId = snapshot.InvoiceId
                WHERE snapshot.InvoiceId = @InvoiceId
                ORDER BY snapshot.CreatedAtUtc DESC;
                """;
            command.Parameters.AddWithValue("@InvoiceId", invoiceId);

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (await reader.ReadAsync(cancellationToken))
            {
                var invoiceNumber = reader["InvoiceNumber"] as string ?? invoiceId.ToString();
                var storagePath = reader["StoragePath"] as string;
                var contentType = reader["ContentType"] as string ?? "application/pdf";
                await reader.DisposeAsync();

                if (!string.IsNullOrWhiteSpace(storagePath) && File.Exists(storagePath))
                {
                    return new DocumentStreamResult(
                        $"{Path.GetFileName(invoiceNumber)}.pdf",
                        contentType,
                        new FileStream(storagePath, FileMode.Open, FileAccess.Read, FileShare.Read));
                }
            }
        }

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
                ia.StoragePath
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
            await reader.DisposeAsync();

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

            logger.LogWarning(
                "Saved attachment is unavailable for InvoiceId={InvoiceId}, AttachmentId={AttachmentId}, StoragePath={StoragePath}. The background sync will repair it.",
                invoiceId,
                attachmentId,
                storagePath);
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

    private string? ResolveLocalAttachmentPath(string attachmentId, string fileName)
    {
        var root = ResolveWorkspaceRoot();
        var searchDirectories = new[]
        {
            Path.Combine(root, "src", "InvoiceLens.OpenInvoiceMock", "Storage", "attachments"),
            Path.Combine(root, "tmp", "openinvoice-hydrated-attachments"),
            Path.Combine(root, "Storage", "attachments")
        };

        var candidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            attachmentId,
            Path.GetFileName(fileName),
            Path.GetFileNameWithoutExtension(fileName),
            $"{attachmentId}{Path.GetExtension(fileName)}",
            $"{attachmentId}-{Path.GetFileName(fileName)}"
        };

        foreach (var directory in searchDirectories)
        {
            if (!Directory.Exists(directory))
            {
                continue;
            }

            foreach (var path in Directory.EnumerateFiles(directory, "*", SearchOption.TopDirectoryOnly))
            {
                var name = Path.GetFileName(path);
                if (candidates.Contains(name) ||
                    name.StartsWith($"{attachmentId}-", StringComparison.OrdinalIgnoreCase) ||
                    name.StartsWith($"{attachmentId}.", StringComparison.OrdinalIgnoreCase) ||
                    name.Contains(attachmentId, StringComparison.OrdinalIgnoreCase))
                {
                    return path;
                }
            }
        }

        return null;
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
