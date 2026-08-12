using InvoiceLens.Infrastructure.OpenInvoice;
using InvoiceLens.Worker.Schedules;
using Microsoft.Extensions.Options;

namespace InvoiceLens.Worker.Jobs;

public sealed class PostOpenInvoiceEventsJob(
    OpenInvoiceSyncService syncService,
    IOptions<SyncScheduleOptions> options,
    ILogger<PostOpenInvoiceEventsJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromMinutes(Math.Max(1, options.Value.RetryMinutes));

        await RecurringJobRunner.RunAsync(
            "OpenInvoice event post",
            interval,
            async token =>
            {
                var completed = await syncService.PostPendingEventsAsync(token);
                logger.LogInformation("OpenInvoice event post completed {Completed} events.", completed);
            },
            logger,
            stoppingToken);
    }
}
