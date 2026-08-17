namespace InvoiceLens.Infrastructure.OpenInvoice;

public interface IOpenInvoiceClient
{
    Task<bool> PingAsync(CancellationToken cancellationToken);

    Task<HttpResponseMessage> GetInvoiceListAsync(string query, CancellationToken cancellationToken);

    Task<HttpResponseMessage> GetInvoiceAsync(string invoiceId, CancellationToken cancellationToken);

    Task<HttpResponseMessage> GetInvoiceAttachmentsAsync(string invoiceId, CancellationToken cancellationToken);

    Task<HttpResponseMessage> GetInvoiceAttachmentAsync(string invoiceId, string attachmentId, CancellationToken cancellationToken);

    Task<HttpResponseMessage> GetInvoiceSnapshotAsync(string invoiceId, CancellationToken cancellationToken);

    Task<HttpResponseMessage> PostEventAsync(string eventPath, string payloadJson, CancellationToken cancellationToken);
}
