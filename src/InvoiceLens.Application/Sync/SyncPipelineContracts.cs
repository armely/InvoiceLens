namespace InvoiceLens.Application.Sync;

public interface IInvoiceListSyncHandler
{
    Task<int> HandleAsync(CancellationToken cancellationToken);
}

public interface IInvoiceDetailSyncHandler
{
    Task<int> HandleAsync(int listCount, CancellationToken cancellationToken);
}

public interface IInvoiceUpsertHandler
{
    Task<int> HandleAsync(int detailCount, CancellationToken cancellationToken);
}

public interface ISyncCheckpointHandler
{
    Task SaveAsync(int processedItems, CancellationToken cancellationToken);
}
