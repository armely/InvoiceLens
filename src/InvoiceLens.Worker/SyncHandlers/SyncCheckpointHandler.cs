using InvoiceLens.Application.Sync;

namespace InvoiceLens.Worker.SyncHandlers;

public class SyncCheckpointHandler : ISyncCheckpointHandler
{
    public Task SaveAsync(int processedItems, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
