using InvoiceLens.Infrastructure.OpenInvoice;
using InvoiceLens.Worker.Schedules;
using Microsoft.Extensions.Options;

namespace InvoiceLens.Worker.Jobs;

public sealed class RetryFailedOpenInvoiceEventsJob(
    OpenInvoiceSyncService syncService,
    IOptions<SyncScheduleOptions> options,
    ILogger<RetryFailedOpenInvoiceEventsJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromMinutes(Math.Max(1, options.Value.RetryMinutes));

        while (!stoppingToken.IsCancellationRequested)
        {
            var completed = await syncService.RetryFailedEventsAsync(stoppingToken);
            logger.LogInformation("OpenInvoice retry job completed {Completed} events.", completed);
            await Task.Delay(interval, stoppingToken);
        }
    }
}
