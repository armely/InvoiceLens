using System.Text;
using InvoiceLens.Application.Documents;
using InvoiceLens.Application.Invoices;
using InvoiceLens.Infrastructure.LocalInvoices;

namespace InvoiceLens.Infrastructure.DocumentStreaming;

public class DocumentStreamService(IInvoiceQueries invoiceQueries, LocalInvoiceComparisonOptions localInvoiceOptions) : IDocumentQueries
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

    public Task<DocumentStreamResult?> GetAttachmentAsync(Guid invoiceId, string attachmentId, CancellationToken cancellationToken)
    {
        var bytes = Encoding.UTF8.GetBytes($"Mock attachment {attachmentId} for invoice {invoiceId}");
        var stream = new MemoryStream(bytes);
        return Task.FromResult<DocumentStreamResult?>(new DocumentStreamResult($"attachment-{attachmentId}.txt", "text/plain", stream));
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
}
