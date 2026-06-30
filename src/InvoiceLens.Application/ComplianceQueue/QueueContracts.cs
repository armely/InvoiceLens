namespace InvoiceLens.Application.ComplianceQueue;

public record QueueItemDto(Guid InvoiceId, string InvoiceNumber, string Vendor, string Reason, DateTimeOffset QueuedAt);

public interface IQueueService
{
    Task<IReadOnlyList<QueueItemDto>> GetQueueAsync(CancellationToken cancellationToken);
}
