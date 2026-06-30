using InvoiceLens.Domain.Entities;
using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Application.Audit;

public record AuditEntryDto(Guid AuditEntryId, Guid InvoiceId, AuditActionType ActionType, string PerformedBy, string Details, DateTimeOffset OccurredAtUtc);

public interface IAuditRepository
{
    Task AddAsync(AuditEntry entry, CancellationToken cancellationToken);

    Task<IReadOnlyList<AuditEntry>> GetByInvoiceAsync(Guid invoiceId, CancellationToken cancellationToken);
}
