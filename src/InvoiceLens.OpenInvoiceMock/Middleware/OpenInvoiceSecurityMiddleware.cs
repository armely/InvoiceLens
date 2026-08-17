using System.Security.Cryptography;
using System.Text;
using InvoiceLens.Infrastructure.OpenInvoice;

namespace InvoiceLens.OpenInvoiceMock;

public sealed class OpenInvoiceSecurityMiddleware(RequestDelegate next, OpenInvoiceOptions options, ILogger<OpenInvoiceSecurityMiddleware> logger)
{
    private readonly OpenInvoiceOptions _options = options;

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/docp"))
        {
            await next(context);
            return;
        }

        if (_options.EnableAllowedIpSimulation && !IsAllowedIp(context))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                messages = new[]
                {
                    new { type = "error", code = "IP_NOT_ALLOWED", developerMessage = "The request source is not allowed by the OpenInvoice security profile." }
                }
            });
            return;
        }

        if (_options.EnableHmac && !await ValidateMacAsync(context))
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                messages = new[]
                {
                    new { type = "error", code = "INVALID_MAC", developerMessage = "The request did not include a valid HMAC token." }
                }
            });
            return;
        }

        await next(context);
    }

    private bool IsAllowedIp(HttpContext context)
    {
        var remoteIp = context.Connection.RemoteIpAddress?.ToString();
        return !string.IsNullOrWhiteSpace(remoteIp) && _options.AllowedIps.Contains(remoteIp, StringComparer.OrdinalIgnoreCase);
    }

    private async Task<bool> ValidateMacAsync(HttpContext context)
    {
        context.Request.EnableBuffering();
        var body = string.Empty;
        if (context.Request.Method != HttpMethods.Get)
        {
            using var reader = new StreamReader(context.Request.Body, Encoding.UTF8, leaveOpen: true);
            body = await reader.ReadToEndAsync();
            context.Request.Body.Position = 0;
        }

        if (!context.Request.Headers.TryGetValue(_options.MacHeaderName, out var provided))
        {
            logger.LogWarning("OpenInvoice request missing HMAC header.");
            return false;
        }

        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(_options.HmacSigningKey));
        var expected = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(body)));
        var expectedBytes = Encoding.UTF8.GetBytes(expected);
        var providedBytes = Encoding.UTF8.GetBytes(provided.ToString());
        return expectedBytes.Length == providedBytes.Length && CryptographicOperations.FixedTimeEquals(expectedBytes, providedBytes);
    }
}
