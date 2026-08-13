using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using InvoiceLens.Application.Notifications;
using InvoiceLens.Infrastructure.Notifications;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.Api.Controllers;

[ApiController]
[Route("api/admin")]
public class AdminController(
    INotificationService notificationService,
    NotificationOptions notificationOptions,
    NotificationMessageFactory notificationMessageFactory,
    ILogger<AdminController> logger) : ControllerBase
{
    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new { status = "ok", service = "InvoiceLens.Api" });
    }

    [HttpPost("test-email")]
    public async Task<IActionResult> SendTestEmail([FromBody] SendAdminTestEmailRequest? request, CancellationToken cancellationToken)
    {
        var recipientEmail = request?.RecipientEmail?.Trim() ?? string.Empty;
        try
        {
            var signedInEmail = User.FindFirstValue("preferred_username")
                ?? User.FindFirstValue(ClaimTypes.Email)
                ?? string.Empty;

            var signedInName = User.Identity?.Name
                ?? User.FindFirstValue("name")
                ?? signedInEmail;

            recipientEmail = string.IsNullOrWhiteSpace(recipientEmail)
                ? signedInEmail.Trim()
                : recipientEmail;

            if (string.IsNullOrWhiteSpace(recipientEmail))
            {
                return BadRequest(new { message = "No recipient email was provided and the signed-in account has no email claim." });
            }

            if (!notificationOptions.Enabled)
            {
                return Ok(new
                {
                    message = "Email notifications are disabled. Enable and configure Microsoft Graph notifications in Settings before sending a test email.",
                    recipientEmail,
                    sent = false,
                });
            }

            if (string.IsNullOrWhiteSpace(notificationOptions.SenderUserId)
                || string.IsNullOrWhiteSpace(notificationOptions.TenantId)
                || string.IsNullOrWhiteSpace(notificationOptions.ClientId)
                || string.IsNullOrWhiteSpace(notificationOptions.ClientSecret))
            {
                return Ok(new
                {
                    message = "Microsoft Graph email settings are incomplete. Configure the sender mailbox, tenant, client ID, and client secret.",
                    recipientEmail,
                    sent = false,
                });
            }

            var message = notificationMessageFactory.CreateTestEmail(signedInName, recipientEmail);
            await notificationService.SendAsync(message, cancellationToken);

            return Ok(new
            {
                message = $"Test email sent to {recipientEmail}.",
                recipientEmail,
                sent = true,
            });
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Failed to send admin test email to {RecipientEmail}.", recipientEmail);
            return StatusCode(StatusCodes.Status502BadGateway, new
            {
                message = exception.Message,
                recipientEmail,
            });
        }
    }
}

public sealed class SendAdminTestEmailRequest
{
    [EmailAddress]
    public string? RecipientEmail { get; init; }
}
