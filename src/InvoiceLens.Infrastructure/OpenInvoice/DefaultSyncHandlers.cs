using InvoiceLens.Application.Sync;

namespace InvoiceLens.Infrastructure.OpenInvoice;

public class DefaultInvoiceListSyncHandler : IInvoiceListSyncHandler
{
    public Task<int> HandleAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult(25);
    }
}

public class DefaultInvoiceDetailSyncHandler : IInvoiceDetailSyncHandler
{
    public Task<int> HandleAsync(int listCount, CancellationToken cancellationToken)
    {
        return Task.FromResult(listCount);
    }
}

public class DefaultInvoiceUpsertHandler : IInvoiceUpsertHandler
{
    public Task<int> HandleAsync(int detailCount, CancellationToken cancellationToken)
    {
        return Task.FromResult(detailCount);
    }
}

public class DefaultSyncCheckpointHandler : ISyncCheckpointHandler
{
    public Task SaveAsync(int processedItems, CancellationToken cancellationToken)
    {
        return Task.CompletedTask;
    }
}
