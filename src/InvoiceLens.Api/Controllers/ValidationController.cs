using InvoiceLens.Application.Validation;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.Api.Controllers;

[ApiController]
[Route("api/invoices/{invoiceId:guid}")]
public class ValidationController(IValidationService validationService) : ControllerBase
{
    [HttpPost("validate")]
    public async Task<ActionResult<ValidationSummaryDto>> Validate(Guid invoiceId, CancellationToken cancellationToken)
    {
        var result = await validationService.RunValidationAsync(invoiceId, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }
}
