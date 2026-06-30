using InvoiceLens.Domain.Entities;
using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Application.Audit;

public class AuditEventFactory
{
    public AuditEntry Create(Guid invoiceId, AuditActionType actionType, string performedBy, string details)
    {
        return new AuditEntry
        {
            AuditEntryId = Guid.NewGuid(),
            InvoiceId = invoiceId,
            ActionType = actionType,
            PerformedBy = performedBy,
            Details = details,
            OccurredAtUtc = DateTimeOffset.UtcNow
        };
    }
}
