using InvoiceLens.Application.Sync;
using InvoiceLens.Worker.Schedules;
using Microsoft.Extensions.Options;

namespace InvoiceLens.Worker.Jobs;

public class IncrementalInvoiceSyncJob(
    RunIncrementalSyncCommand command,
    IOptions<SyncScheduleOptions> options,
    ILogger<IncrementalInvoiceSyncJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromMinutes(Math.Max(1, options.Value.IncrementalSyncMinutes));

        while (!stoppingToken.IsCancellationRequested)
        {
            var result = await command.ExecuteAsync(stoppingToken);
            logger.LogInformation("Incremental sync status: {Status}", result.Status);
            await Task.Delay(interval, stoppingToken);
        }
    }
}
