using InvoiceLens.Application.Sync;

namespace InvoiceLens.Worker.SyncHandlers;

public class InvoiceUpsertHandler : IInvoiceUpsertHandler
{
    public Task<int> HandleAsync(int detailCount, CancellationToken cancellationToken)
    {
        return Task.FromResult(detailCount);
    }
}
