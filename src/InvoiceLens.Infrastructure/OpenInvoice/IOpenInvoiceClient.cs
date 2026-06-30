namespace InvoiceLens.Infrastructure.OpenInvoice;

public interface IOpenInvoiceClient
{
    Task<bool> PingAsync(CancellationToken cancellationToken);
}
