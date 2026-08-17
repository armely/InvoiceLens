using InvoiceLens.Application.Validation;
using InvoiceLens.Application.Notifications;
using InvoiceLens.Infrastructure.Notifications;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.Api.Controllers;

[ApiController]
[Route("api/invoices/{invoiceId:guid}")]
public class ValidationController(
    RunInvoiceValidationCommand runValidation,
    GetValidationSummaryQuery getValidationSummary,
    INotificationService notificationService,
    NotificationMessageFactory notificationMessageFactory,
    ILogger<ValidationController> logger) : ControllerBase
{
    [HttpPost("validate")]
    public async Task<ActionResult<ValidationSummaryDto>> Validate(Guid invoiceId, CancellationToken cancellationToken)
    {
        var result = await runValidation.ExecuteAsync(invoiceId, cancellationToken);

        if (result is not null && !result.OverallStatus.Equals("Pass", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var message = notificationMessageFactory.CreateInvoiceFlagged(invoiceId, result);
                await notificationService.SendAsync(message, cancellationToken);
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "Validation completed for {InvoiceId}, but flag notification delivery failed.", invoiceId);
            }
        }

        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("validation-summary")]
    public async Task<ActionResult<ValidationSummaryDto>> GetSummary(Guid invoiceId, CancellationToken cancellationToken)
    {
        var result = await getValidationSummary.ExecuteAsync(invoiceId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }
}
