using InvoiceLens.Application.Sync;
using InvoiceLens.Worker.Schedules;
using Microsoft.Extensions.Options;

namespace InvoiceLens.Worker.Jobs;

public class ReconciliationJob(
    RunReconciliationCommand command,
    IOptions<SyncScheduleOptions> options,
    ILogger<ReconciliationJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromMinutes(Math.Max(5, options.Value.ReconciliationMinutes));

        while (!stoppingToken.IsCancellationRequested)
        {
            var result = await command.ExecuteAsync(stoppingToken);
            logger.LogInformation("Reconciliation status: {Status}", result.Status);
            await Task.Delay(interval, stoppingToken);
        }
    }
}
