using InvoiceLens.Application.InvoiceComparison;
using InvoiceLens.Infrastructure.LocalInvoices;

namespace InvoiceLens.Worker.Jobs;

public sealed class LoadAndCompareLocalInvoicesJob(
    IInvoiceComparisonService comparisonService,
    LocalInvoiceComparisonOptions options,
    ILogger<LoadAndCompareLocalInvoicesJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Enabled)
        {
            logger.LogInformation("Local invoice comparison is disabled.");
            return;
        }

        logger.LogInformation("Loading local invoices from {PdfFolder} and {MetadataFolder}.", options.PdfFolder, options.MetadataFolder);
        var loaded = await comparisonService.LoadLocalInvoicesAsync(stoppingToken);
        logger.LogInformation("Loaded {LoadedCount} local invoice files.", loaded);

        if (!options.AutoCompareOnStartup)
        {
            return;
        }

        var localInvoices = await comparisonService.GetLocalInvoicesAsync(stoppingToken);
        foreach (var invoice in localInvoices)
        {
            logger.LogInformation("Comparing local invoice file {LocalInvoiceFileId} ({FileName}).", invoice.LocalInvoiceFileId, invoice.FileName);
            await comparisonService.RunComparisonAsync(invoice.LocalInvoiceFileId, stoppingToken);
        }
    }
}
