namespace InvoiceLens.Application.Sync;

public class RunIncrementalSyncCommand(ISyncOrchestrator orchestrator)
{
    public Task<SyncStatusDto> ExecuteAsync(CancellationToken cancellationToken)
    {
        return orchestrator.RunIncrementalSyncAsync(cancellationToken);
    }
}
