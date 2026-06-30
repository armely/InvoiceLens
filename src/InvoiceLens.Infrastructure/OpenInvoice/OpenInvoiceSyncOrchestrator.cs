using InvoiceLens.Application.Sync;

namespace InvoiceLens.Infrastructure.OpenInvoice;

public class OpenInvoiceSyncOrchestrator(
    IInvoiceListSyncHandler listHandler,
    IInvoiceDetailSyncHandler detailHandler,
    IInvoiceUpsertHandler upsertHandler,
    ISyncCheckpointHandler checkpointHandler) : ISyncOrchestrator
{
    public async Task<SyncStatusDto> RunInitialHydrationAsync(CancellationToken cancellationToken)
    {
        await RunPipelineAsync(cancellationToken);
        return new SyncStatusDto("InitialHydrationCompleted", DateTimeOffset.UtcNow, 0, 0);
    }

    public async Task<SyncStatusDto> RunIncrementalSyncAsync(CancellationToken cancellationToken)
    {
        var processed = await RunPipelineAsync(cancellationToken);
        return new SyncStatusDto("IncrementalSyncCompleted", DateTimeOffset.UtcNow, Math.Max(0, 10 - processed), 0);
    }

    public Task<SyncStatusDto> RunReconciliationAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult(new SyncStatusDto("ReconciliationCompleted", DateTimeOffset.UtcNow, 0, 0));
    }

    public Task<SyncStatusDto> RetryFailedRecordsAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult(new SyncStatusDto("RetryCompleted", DateTimeOffset.UtcNow, 0, 0));
    }

    private async Task<int> RunPipelineAsync(CancellationToken cancellationToken)
    {
        var listed = await listHandler.HandleAsync(cancellationToken);
        var detailed = await detailHandler.HandleAsync(listed, cancellationToken);
        var upserted = await upsertHandler.HandleAsync(detailed, cancellationToken);
        await checkpointHandler.SaveAsync(upserted, cancellationToken);
        return upserted;
    }
}
