namespace InvoiceLens.Infrastructure.OpenInvoice;

public class OpenInvoiceClient : IOpenInvoiceClient
{
    public Task<bool> PingAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult(true);
    }
}
