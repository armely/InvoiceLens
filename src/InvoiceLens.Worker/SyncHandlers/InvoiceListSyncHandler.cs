namespace InvoiceLens.Worker.SyncHandlers;

public class InvoiceListSyncHandler
{
    public Task<int> HandleAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult(25);
    }
}
