using InvoiceLens.Application.ComplianceQueue;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.Api.Controllers;

[ApiController]
[Route("api/queue")]
public class QueueController(IQueueService queueService) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<QueueItemDto>>> GetQueue(CancellationToken cancellationToken)
    {
        var queue = await queueService.GetQueueAsync(cancellationToken);
        return Ok(queue);
    }
}
