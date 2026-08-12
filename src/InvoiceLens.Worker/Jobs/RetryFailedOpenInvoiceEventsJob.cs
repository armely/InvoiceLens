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

        await RecurringJobRunner.RunAsync(
            "OpenInvoice event retry",
            interval,
            async token =>
            {
                var completed = await syncService.RetryFailedEventsAsync(token);
                logger.LogInformation("OpenInvoice retry job completed {Completed} events.", completed);
            },
            logger,
            stoppingToken);
    }
}
