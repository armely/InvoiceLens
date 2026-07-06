namespace InvoiceLens.Infrastructure.OpenInvoice;

public sealed class OpenInvoiceClient(HttpClient httpClient, OpenInvoiceOptions options)
    : HttpOpenInvoiceClient(httpClient, options)
{
}
