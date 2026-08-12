using InvoiceLens.Infrastructure.OpenInvoice;
using InvoiceLens.Worker.Schedules;
using Microsoft.Extensions.Options;

namespace InvoiceLens.Worker.Jobs;

public sealed class SyncOpenInvoiceInvoiceDetailsJob(
    OpenInvoiceSyncService syncService,
    IOptions<SyncScheduleOptions> options,
    ILogger<SyncOpenInvoiceInvoiceDetailsJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromMinutes(Math.Max(5, options.Value.IncrementalSyncMinutes));

        await RecurringJobRunner.RunAsync(
            "OpenInvoice detail sync",
            interval,
            async token =>
            {
                var imported = await syncService.SyncInvoiceDetailsAsync(token);
                logger.LogInformation("OpenInvoice detail sync processed {Imported} records.", imported);
            },
            logger,
            stoppingToken);
    }
}
