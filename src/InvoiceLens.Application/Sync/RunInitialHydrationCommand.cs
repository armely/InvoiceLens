namespace InvoiceLens.Application.Sync;

public class RunInitialHydrationCommand(ISyncOrchestrator orchestrator)
{
    public Task<SyncStatusDto> ExecuteAsync(CancellationToken cancellationToken)
    {
        return orchestrator.RunInitialHydrationAsync(cancellationToken);
    }
}
