using InvoiceLens.Infrastructure.OpenInvoice;
using InvoiceLens.Worker.Schedules;
using Microsoft.Extensions.Options;

namespace InvoiceLens.Worker.Jobs;

public sealed class SyncOpenInvoiceInvoicesJob(
    OpenInvoiceSyncService syncService,
    IOptions<SyncScheduleOptions> options,
    ILogger<SyncOpenInvoiceInvoicesJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var interval = TimeSpan.FromMinutes(Math.Max(5, options.Value.IncrementalSyncMinutes));

        while (!stoppingToken.IsCancellationRequested)
        {
            var imported = await syncService.SyncInvoicesAsync(stoppingToken);
            logger.LogInformation("OpenInvoice invoice sync imported {Imported} records.", imported);
            await Task.Delay(interval, stoppingToken);
        }
    }
}
