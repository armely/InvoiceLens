using InvoiceLens.Application.Sync;

namespace InvoiceLens.Worker.SyncHandlers;

public class InvoiceDetailSyncHandler : IInvoiceDetailSyncHandler
{
    public Task<int> HandleAsync(int listCount, CancellationToken cancellationToken)
    {
        return Task.FromResult(listCount);
    }
}
