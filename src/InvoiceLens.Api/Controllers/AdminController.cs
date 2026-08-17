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
        var signedInEmail = User.FindFirstValue("preferred_username")
            ?? User.FindFirstValue(ClaimTypes.Email)
            ?? string.Empty;

        var signedInName = User.Identity?.Name
            ?? User.FindFirstValue("name")
            ?? signedInEmail;

        var recipientEmail = string.IsNullOrWhiteSpace(request?.RecipientEmail)
            ? signedInEmail.Trim()
            : request!.RecipientEmail.Trim();

        if (string.IsNullOrWhiteSpace(recipientEmail))
        {
            return BadRequest(new { message = "No recipient email was provided and the signed-in account has no email claim." });
        }

        try
        {
            var message = notificationMessageFactory.CreateTestEmail(signedInName, recipientEmail);
            await notificationService.SendAsync(message, cancellationToken);

            return Ok(new
            {
                message = $"Test email sent to {recipientEmail}.",
                recipientEmail,
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

public sealed record SendAdminTestEmailRequest(
    [property: EmailAddress] string? RecipientEmail);
