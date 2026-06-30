using InvoiceLens.Application.Validation;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.Api.Controllers;

[ApiController]
[Route("api/invoices/{invoiceId:guid}")]
public class ValidationController(RunInvoiceValidationCommand runValidation, GetValidationSummaryQuery getValidationSummary) : ControllerBase
{
    [HttpPost("validate")]
    public async Task<ActionResult<ValidationSummaryDto>> Validate(Guid invoiceId, CancellationToken cancellationToken)
    {
        var result = await runValidation.ExecuteAsync(invoiceId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    [HttpGet("validation-summary")]
    public async Task<ActionResult<ValidationSummaryDto>> GetSummary(Guid invoiceId, CancellationToken cancellationToken)
    {
        var result = await getValidationSummary.ExecuteAsync(invoiceId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }
}
