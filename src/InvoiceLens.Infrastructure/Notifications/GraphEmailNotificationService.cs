using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using InvoiceLens.Application.Notifications;
using Microsoft.Extensions.Logging;

namespace InvoiceLens.Infrastructure.Notifications;

public sealed class GraphEmailNotificationService(
    NotificationOptions options,
    IHttpClientFactory httpClientFactory,
    ILogger<GraphEmailNotificationService> logger) : INotificationService
{
    private readonly NotificationOptions _options = options;

    public async Task SendAsync(NotificationMessage message, CancellationToken cancellationToken)
    {
        if (!_options.Enabled)
        {
            return;
        }

        if (_options.Recipients.Length == 0 || string.IsNullOrWhiteSpace(_options.SenderUserId))
        {
            logger.LogWarning("Notifications are enabled but no recipients or sender mailbox is configured.");
            return;
        }

        if (string.IsNullOrWhiteSpace(_options.TenantId)
            || string.IsNullOrWhiteSpace(_options.ClientId)
            || string.IsNullOrWhiteSpace(_options.ClientSecret))
        {
            logger.LogWarning("Notifications are enabled but Graph app registration values are missing.");
            return;
        }

        try
        {
            var token = await AcquireTokenAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(token))
            {
                logger.LogWarning("Graph token acquisition returned an empty token.");
                return;
            }

            var client = httpClientFactory.CreateClient();
            using var request = new HttpRequestMessage(HttpMethod.Post, $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(_options.SenderUserId)}/sendMail");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var recipients = _options.Recipients
                .Where(address => !string.IsNullOrWhiteSpace(address))
                .Select(address => new
                {
                    emailAddress = new
                    {
                        address = address.Trim()
                    }
                })
                .ToArray();

            if (recipients.Length == 0)
            {
                logger.LogWarning("Notifications are enabled but recipient list resolved to empty values.");
                return;
            }

            var payload = new
            {
                message = new
                {
                    subject = $"[{_options.SubjectPrefix}] {message.Subject}",
                    body = new
                    {
                        contentType = "Text",
                        content = message.PlainTextBody
                    },
                    toRecipients = recipients
                },
                saveToSentItems = false
            };

            request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            using var response = await client.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);
                logger.LogWarning(
                    "Failed to send notification email. Category={Category}, Status={StatusCode}, Response={ResponseBody}",
                    message.Category,
                    response.StatusCode,
                    responseBody);
            }
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Failed to send notification email for {Category}.", message.Category);
        }
    }

    private async Task<string?> AcquireTokenAsync(CancellationToken cancellationToken)
    {
        var client = httpClientFactory.CreateClient();
        using var tokenRequest = new HttpRequestMessage(HttpMethod.Post, $"https://login.microsoftonline.com/{Uri.EscapeDataString(_options.TenantId)}/oauth2/v2.0/token");
        tokenRequest.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["grant_type"] = "client_credentials",
            ["client_id"] = _options.ClientId,
            ["client_secret"] = _options.ClientSecret,
            ["scope"] = "https://graph.microsoft.com/.default"
        });

        using var tokenResponse = await client.SendAsync(tokenRequest, cancellationToken);
        if (!tokenResponse.IsSuccessStatusCode)
        {
            var responseBody = await tokenResponse.Content.ReadAsStringAsync(cancellationToken);
            logger.LogWarning("Could not acquire Graph token. Status={StatusCode}, Response={ResponseBody}", tokenResponse.StatusCode, responseBody);
            return null;
        }

        var content = await tokenResponse.Content.ReadAsStringAsync(cancellationToken);
        using var document = JsonDocument.Parse(content);
        return document.RootElement.TryGetProperty("access_token", out var accessToken)
            ? accessToken.GetString()
            : null;
    }
}