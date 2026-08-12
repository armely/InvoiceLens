using InvoiceLens.Infrastructure.OpenInvoice;
using InvoiceLens.Worker.Schedules;
using Microsoft.Extensions.Options;

namespace InvoiceLens.Worker.Jobs;

public sealed class SyncOpenInvoiceAttachmentsJob(
    OpenInvoiceSyncService syncService,
    IOptions<SyncScheduleOptions> options,
    ILogger<SyncOpenInvoiceAttachmentsJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromMinutes(Math.Max(10, options.Value.ReconciliationMinutes));

        await RecurringJobRunner.RunAsync(
            "OpenInvoice attachment sync",
            interval,
            async token =>
            {
                var imported = await syncService.SyncAttachmentsAsync(token);
                logger.LogInformation("OpenInvoice attachment sync processed {Imported} records.", imported);
            },
            logger,
            stoppingToken);
    }
}
