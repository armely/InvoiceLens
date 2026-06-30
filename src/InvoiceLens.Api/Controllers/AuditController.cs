using InvoiceLens.Application.Audit;
using InvoiceLens.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.Api.Controllers;

[ApiController]
[Route("api/invoices/{invoiceId:guid}/audit")]
public class AuditController(GetAuditTrailQuery getAuditTrail, CreateAuditEntryCommand createAuditEntry) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AuditEntryDto>>> GetAuditTrail(Guid invoiceId, CancellationToken cancellationToken)
    {
        var entries = await getAuditTrail.ExecuteAsync(invoiceId, cancellationToken);
        return Ok(entries);
    }

    [HttpPost]
    public async Task<IActionResult> AddAuditEntry(Guid invoiceId, [FromBody] AddAuditEntryRequest request, CancellationToken cancellationToken)
    {
        await createAuditEntry.ExecuteAsync(invoiceId, request.ActionType, request.PerformedBy, request.Details, cancellationToken);
        return NoContent();
    }

    public record AddAuditEntryRequest(AuditActionType ActionType, string PerformedBy, string Details);
}
