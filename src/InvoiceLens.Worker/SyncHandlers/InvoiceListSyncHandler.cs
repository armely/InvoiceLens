using InvoiceLens.Application.Sync;

namespace InvoiceLens.Worker.SyncHandlers;

public class InvoiceListSyncHandler : IInvoiceListSyncHandler
{
    public Task<int> HandleAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult(25);
    }
}
