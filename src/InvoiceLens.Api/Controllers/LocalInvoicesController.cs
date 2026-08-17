using InvoiceLens.Application.InvoiceComparison;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.Api.Controllers;

[ApiController]
[Route("api/local-invoices")]
public sealed class LocalInvoicesController(IInvoiceComparisonService comparisonService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<LocalInvoiceFileDto>>> GetLocalInvoices(CancellationToken cancellationToken)
    {
        var invoices = await comparisonService.GetLocalInvoicesAsync(cancellationToken);
        return Ok(invoices);
    }

    [HttpGet("{localInvoiceFileId:int}/pdf")]
    public async Task<IActionResult> GetLocalInvoicePdf(int localInvoiceFileId, CancellationToken cancellationToken)
    {
        var document = await comparisonService.GetLocalInvoicePdfAsync(localInvoiceFileId, cancellationToken);
        return document is null ? NotFound() : File(document.Content, document.ContentType);
    }

    [HttpPost("load")]
    public async Task<IActionResult> LoadLocalInvoices(CancellationToken cancellationToken)
    {
        var loaded = await comparisonService.LoadLocalInvoicesAsync(cancellationToken);
        return Ok(new { loaded });
    }
}
