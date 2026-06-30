using System.Text;
using InvoiceLens.Application.Documents;

namespace InvoiceLens.Infrastructure.DocumentStreaming;

public class DocumentStreamService : IDocumentQueries
{
    public Task<DocumentStreamResult?> GetSnapshotAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var bytes = Encoding.UTF8.GetBytes($"Mock snapshot for invoice {invoiceId}");
        var stream = new MemoryStream(bytes);
        return Task.FromResult<DocumentStreamResult?>(new DocumentStreamResult($"snapshot-{invoiceId}.txt", "text/plain", stream));
    }

    public Task<DocumentStreamResult?> GetAttachmentAsync(Guid invoiceId, string attachmentId, CancellationToken cancellationToken)
    {
        var bytes = Encoding.UTF8.GetBytes($"Mock attachment {attachmentId} for invoice {invoiceId}");
        var stream = new MemoryStream(bytes);
        return Task.FromResult<DocumentStreamResult?>(new DocumentStreamResult($"attachment-{attachmentId}.txt", "text/plain", stream));
    }
}
