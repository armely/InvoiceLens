using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Domain.Entities;

public class AuditEntry
{
    public Guid AuditEntryId { get; set; } = Guid.NewGuid();

    public Guid InvoiceId { get; set; }

    public AuditActionType ActionType { get; set; }

    public string PerformedBy { get; set; } = string.Empty;

    public string Details { get; set; } = string.Empty;

    public DateTimeOffset OccurredAtUtc { get; set; } = DateTimeOffset.UtcNow;
}
