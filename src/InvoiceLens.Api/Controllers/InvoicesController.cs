using InvoiceLens.Application.Audit;
using InvoiceLens.Application.Invoices;
using InvoiceLens.Domain.Enums;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.Api.Controllers;

[ApiController]
[Route("api/invoices")]
public class InvoicesController(IInvoiceQueries invoiceQueries, CreateAuditEntryCommand createAuditEntry) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<InvoiceSummaryDto>>> GetInvoices([FromQuery] string? query, CancellationToken cancellationToken)
    {
        var invoices = await invoiceQueries.SearchAsync(query, cancellationToken);
        return Ok(invoices);
    }

    [HttpGet("{invoiceId:guid}")]
    public async Task<ActionResult<InvoiceDetailDto>> GetInvoice(Guid invoiceId, CancellationToken cancellationToken)
    {
        var invoice = await invoiceQueries.GetDetailAsync(invoiceId, cancellationToken);
        return invoice is null ? NotFound() : Ok(invoice);
    }

    [HttpGet("{invoiceId:guid}/review")]
    public async Task<ActionResult<InvoiceReviewDto>> GetInvoiceReview(Guid invoiceId, CancellationToken cancellationToken)
    {
        var review = await invoiceQueries.GetReviewAsync(invoiceId, cancellationToken);
        return review is null ? NotFound() : Ok(review);
    }

    [HttpPost("{invoiceId:guid}/approve")]
    public async Task<IActionResult> Approve(Guid invoiceId, CancellationToken cancellationToken)
    {
        var updated = await invoiceQueries.ApproveAsync(invoiceId, cancellationToken);
        if (updated)
        {
            await createAuditEntry.ExecuteAsync(invoiceId, AuditActionType.Approved, "system", "Invoice approved", cancellationToken);
        }
        return updated ? NoContent() : NotFound();
    }

    [HttpPost("{invoiceId:guid}/send-back")]
    public async Task<IActionResult> SendBack(Guid invoiceId, CancellationToken cancellationToken)
    {
        var updated = await invoiceQueries.SendBackAsync(invoiceId, cancellationToken);
        if (updated)
        {
            await createAuditEntry.ExecuteAsync(invoiceId, AuditActionType.SentBack, "system", "Invoice sent back", cancellationToken);
        }
        return updated ? NoContent() : NotFound();
    }
}
