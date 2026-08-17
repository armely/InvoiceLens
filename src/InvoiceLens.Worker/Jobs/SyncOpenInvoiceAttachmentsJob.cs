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

        while (!stoppingToken.IsCancellationRequested)
        {
            var imported = await syncService.SyncAttachmentsAsync(stoppingToken);
            logger.LogInformation("OpenInvoice attachment sync processed {Imported} records.", imported);
            await Task.Delay(interval, stoppingToken);
        }
    }
}
