using System.Net.Http.Headers;

namespace InvoiceLens.Infrastructure.OpenInvoice;

public class HttpOpenInvoiceClient(HttpClient httpClient, OpenInvoiceOptions options) : IOpenInvoiceClient
{
    private readonly OpenInvoiceOptions _options = options;

    public async Task<bool> PingAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var response = await httpClient.GetAsync("/docp/supply-chain/v1/invoices?$top=1&$count=true", cancellationToken);
            return response.IsSuccessStatusCode;
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException)
        {
            return false;
        }
    }

    public Task<HttpResponseMessage> GetInvoiceListAsync(string query, CancellationToken cancellationToken)
    {
        return SendAsync(HttpMethod.Get, $"/docp/supply-chain/v1/invoices{query}", null, "application/json", cancellationToken);
    }

    public Task<HttpResponseMessage> GetInvoiceAsync(string invoiceId, CancellationToken cancellationToken)
    {
        return SendAsync(HttpMethod.Get, $"/docp/supply-chain/v1/invoices/{Uri.EscapeDataString(invoiceId)}?$select=all", null, "application/xml", cancellationToken);
    }

    public Task<HttpResponseMessage> GetInvoiceAttachmentsAsync(string invoiceId, CancellationToken cancellationToken)
    {
        return SendAsync(HttpMethod.Get, $"/docp/supply-chain/v1/invoices/{Uri.EscapeDataString(invoiceId)}/attachments", null, "application/json", cancellationToken);
    }

    public Task<HttpResponseMessage> GetInvoiceAttachmentAsync(string invoiceId, string attachmentId, CancellationToken cancellationToken)
    {
        return SendAsync(HttpMethod.Get, $"/docp/supply-chain/v1/invoices/{Uri.EscapeDataString(invoiceId)}/attachments/{Uri.EscapeDataString(attachmentId)}", null, "*/*", cancellationToken);
    }

    public Task<HttpResponseMessage> GetInvoiceSnapshotAsync(string invoiceId, CancellationToken cancellationToken)
    {
        return SendAsync(HttpMethod.Get, $"/docp/supply-chain/v1/invoices/{Uri.EscapeDataString(invoiceId)}/snapshot", null, "*/*", cancellationToken);
    }

    public Task<HttpResponseMessage> PostEventAsync(string eventPath, string payloadJson, CancellationToken cancellationToken)
    {
        var content = new StringContent(payloadJson, System.Text.Encoding.UTF8, "application/json");
        return SendAsync(HttpMethod.Post, $"/docp/events/supply-chain/v1/{eventPath}", content, "application/json", cancellationToken);
    }

    private Task<HttpResponseMessage> SendAsync(HttpMethod method, string relativeUrl, HttpContent? content, string accept, CancellationToken cancellationToken)
    {
        var request = new HttpRequestMessage(method, relativeUrl);
        if (content is not null)
        {
            request.Content = content;
        }

        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(accept));
        return httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
    }
}
