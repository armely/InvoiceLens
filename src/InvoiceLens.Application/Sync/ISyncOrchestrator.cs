namespace InvoiceLens.Application.Sync;

public interface ISyncOrchestrator
{
    Task<SyncStatusDto> RunInitialHydrationAsync(CancellationToken cancellationToken);

    Task<SyncStatusDto> RunIncrementalSyncAsync(CancellationToken cancellationToken);

    Task<SyncStatusDto> RunReconciliationAsync(CancellationToken cancellationToken);

    Task<SyncStatusDto> RetryFailedRecordsAsync(CancellationToken cancellationToken);
}
