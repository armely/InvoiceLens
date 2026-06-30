namespace InvoiceLens.Application.Sync;

public class RunReconciliationCommand(ISyncOrchestrator orchestrator)
{
    public Task<SyncStatusDto> ExecuteAsync(CancellationToken cancellationToken)
    {
        return orchestrator.RunReconciliationAsync(cancellationToken);
    }
}
