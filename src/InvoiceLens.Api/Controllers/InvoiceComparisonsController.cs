using InvoiceLens.Application.InvoiceComparison;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.Api.Controllers;

[ApiController]
[Route("api/invoice-comparisons")]
public sealed class InvoiceComparisonsController(IInvoiceComparisonService comparisonService) : ControllerBase
{
    [HttpPost("{localInvoiceFileId:int}/run")]
    public async Task<ActionResult<InvoiceComparisonRunDto>> RunComparison(int localInvoiceFileId, CancellationToken cancellationToken)
    {
        var run = await comparisonService.RunComparisonAsync(localInvoiceFileId, cancellationToken);
        return run is null ? NotFound() : Ok(run);
    }

    [HttpGet("{comparisonRunId:int}")]
    public async Task<ActionResult<InvoiceComparisonRunDto>> GetComparisonRun(int comparisonRunId, CancellationToken cancellationToken)
    {
        var run = await comparisonService.GetComparisonRunAsync(comparisonRunId, cancellationToken);
        return run is null ? NotFound() : Ok(run);
    }
}
