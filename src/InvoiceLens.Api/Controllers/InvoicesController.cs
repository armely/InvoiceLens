using InvoiceLens.Application.Audit;
using InvoiceLens.Application.Invoices;
using InvoiceLens.Domain.Enums;
using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.Api.Controllers;

[ApiController]
[Route("api/invoices")]
public class InvoicesController(IInvoiceQueries invoiceQueries, CreateAuditEntryCommand createAuditEntry, ILogger<InvoicesController> logger) : ControllerBase
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
        return await UpdateStatusAsync(
            invoiceId,
            () => invoiceQueries.ApproveAsync(invoiceId, cancellationToken),
            AuditActionType.Approved,
            "Invoice approved",
            cancellationToken);
    }

    [HttpPost("{invoiceId:guid}/send-back")]
    public async Task<IActionResult> SendBack(Guid invoiceId, CancellationToken cancellationToken)
    {
        return await UpdateStatusAsync(
            invoiceId,
            () => invoiceQueries.SendBackAsync(invoiceId, cancellationToken),
            AuditActionType.SentBack,
            "Invoice sent back",
            cancellationToken);
    }

    private async Task<IActionResult> UpdateStatusAsync(
        Guid invoiceId,
        Func<Task<bool>> update,
        AuditActionType auditActionType,
        string auditDetails,
        CancellationToken cancellationToken)
    {
        try
        {
            var updated = await update();
            if (!updated)
            {
                return NotFound();
            }

            try
            {
                await createAuditEntry.ExecuteAsync(invoiceId, auditActionType, "system", auditDetails, cancellationToken);
            }
            catch (Exception auditError)
            {
                logger.LogWarning(auditError, "Invoice {InvoiceId} was updated but the audit entry could not be written.", invoiceId);
            }

            return NoContent();
        }
        catch (SqlException sqlException)
        {
            logger.LogError(sqlException, "Failed to update invoice {InvoiceId}.", invoiceId);
            return Problem("The invoice update could not be completed right now.");
        }
    }
}
