namespace InvoiceLens.Application.Documents;

public record DocumentStreamResult(string FileName, string ContentType, Stream Content);

public interface IDocumentQueries
{
    Task<DocumentStreamResult?> GetSnapshotAsync(Guid invoiceId, CancellationToken cancellationToken);

    Task<DocumentStreamResult?> GetAttachmentAsync(Guid invoiceId, string attachmentId, CancellationToken cancellationToken);
}
