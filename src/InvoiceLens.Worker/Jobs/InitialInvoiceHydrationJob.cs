using InvoiceLens.Application.Sync;

namespace InvoiceLens.Worker.Jobs;

public class InitialInvoiceHydrationJob(RunInitialHydrationCommand command, ILogger<InitialInvoiceHydrationJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Initial hydration job started");
        var result = await command.ExecuteAsync(stoppingToken);
        logger.LogInformation("Initial hydration status: {Status}", result.Status);
    }
}
