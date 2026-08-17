using System.Security.Cryptography;
using System.Text;

namespace InvoiceLens.Infrastructure.OpenInvoice;

public sealed class OpenInvoiceHmacHandler(OpenInvoiceOptions options) : DelegatingHandler
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (!options.EnableHmac || string.IsNullOrWhiteSpace(options.HmacSigningKey))
        {
            return await base.SendAsync(request, cancellationToken);
        }

        var input = request.Method == HttpMethod.Get
            ? string.Empty
            : await ReadRequestBodyAsync(request, cancellationToken);

        var mac = ComputeMac(input, options.HmacSigningKey);
        request.Headers.Remove(options.MacHeaderName);
        request.Headers.TryAddWithoutValidation(options.MacHeaderName, mac);
        return await base.SendAsync(request, cancellationToken);
    }

    private static async Task<string> ReadRequestBodyAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (request.Content is null)
        {
            return string.Empty;
        }

        var bytes = await request.Content.ReadAsByteArrayAsync(cancellationToken);
        var body = Encoding.UTF8.GetString(bytes);
        var rebuiltContent = new ByteArrayContent(bytes);

        foreach (var header in request.Content.Headers)
        {
            rebuiltContent.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        request.Content = rebuiltContent;
        return body;
    }

    private static string ComputeMac(string input, string key)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(key));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToBase64String(hash);
    }
}
