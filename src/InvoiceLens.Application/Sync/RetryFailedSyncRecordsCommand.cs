namespace InvoiceLens.Application.Sync;

public class RetryFailedSyncRecordsCommand(ISyncOrchestrator orchestrator)
{
    public Task<SyncStatusDto> ExecuteAsync(CancellationToken cancellationToken)
    {
        return orchestrator.RetryFailedRecordsAsync(cancellationToken);
    }
}
