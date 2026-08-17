namespace InvoiceLens.OpenInvoiceMock;

public sealed class OpenInvoiceErrorSimulationMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/docp"))
        {
            await next(context);
            return;
        }

        if (TrySimulateStatus(context, "x-openinvoice-simulate-rate-limit", StatusCodes.Status429TooManyRequests))
        {
            return;
        }

        if (TrySimulateStatus(context, "x-openinvoice-simulate-error", out var statusCode))
        {
            context.Response.StatusCode = statusCode;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                messages = new[]
                {
                    new { type = "error", code = $"SIMULATED_{statusCode}", developerMessage = "The OpenInvoice mock was instructed to fail this request." }
                }
            });
            return;
        }

        if (context.Request.Headers.TryGetValue("x-openinvoice-simulate-timeout", out var timeout) && string.Equals(timeout.ToString(), "true", StringComparison.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = StatusCodes.Status504GatewayTimeout;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                messages = new[]
                {
                    new { type = "error", code = "TIMEOUT", developerMessage = "The OpenInvoice mock simulated a timeout." }
                }
            });
            return;
        }

        if (context.Request.Headers.TryGetValue("x-openinvoice-simulate-invalid-gzip", out var invalidGzip) && string.Equals(invalidGzip.ToString(), "true", StringComparison.OrdinalIgnoreCase))
        {
            context.Response.Headers.ContentEncoding = "gzip";
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsync("invalid gzip payload");
            return;
        }

        await next(context);
    }

    private static bool TrySimulateStatus(HttpContext context, string headerName, out int statusCode)
    {
        statusCode = 0;
        if (!context.Request.Headers.TryGetValue(headerName, out var value))
        {
            return false;
        }

        if (!int.TryParse(value.ToString(), out statusCode))
        {
            return false;
        }

        return true;
    }

    private static bool TrySimulateStatus(HttpContext context, string headerName, int defaultStatusCode)
    {
        if (!context.Request.Headers.TryGetValue(headerName, out var value))
        {
            return false;
        }

        if (string.Equals(value.ToString(), "true", StringComparison.OrdinalIgnoreCase))
        {
            context.Response.StatusCode = defaultStatusCode;
            return true;
        }

        if (int.TryParse(value.ToString(), out var statusCode))
        {
            context.Response.StatusCode = statusCode;
            return true;
        }

        return false;
    }
}
