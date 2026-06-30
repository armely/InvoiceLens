using InvoiceLens.Application.Sync;
using InvoiceLens.Worker.Schedules;
using Microsoft.Extensions.Options;

namespace InvoiceLens.Worker.Jobs;

public class FailedRecordRetryJob(
    RetryFailedSyncRecordsCommand command,
    IOptions<SyncScheduleOptions> options,
    ILogger<FailedRecordRetryJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromMinutes(Math.Max(1, options.Value.RetryMinutes));

        while (!stoppingToken.IsCancellationRequested)
        {
            var result = await command.ExecuteAsync(stoppingToken);
            logger.LogInformation("Retry status: {Status}", result.Status);
            await Task.Delay(interval, stoppingToken);
        }
    }
}
