namespace InvoiceLens.Application.Sync;

public record SyncStatusDto(string Status, DateTimeOffset LastSuccessfulRunUtc, int PendingItems, int FailedItems);

public interface ISyncStatusService
{
    Task<SyncStatusDto> GetStatusAsync(CancellationToken cancellationToken);
}
