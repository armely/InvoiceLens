using InvoiceLens.Application.Sync;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.Api.Controllers;

[ApiController]
[Route("api/sync")]
public class SyncController(ISyncStatusService syncStatusService) : ControllerBase
{
    [HttpGet("status")]
    public async Task<ActionResult<SyncStatusDto>> GetStatus(CancellationToken cancellationToken)
    {
        var status = await syncStatusService.GetStatusAsync(cancellationToken);
        return Ok(status);
    }
}
