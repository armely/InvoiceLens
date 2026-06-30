using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Application.Audit;

public class CreateAuditEntryCommand(IAuditRepository auditRepository, AuditEventFactory eventFactory)
{
    public async Task ExecuteAsync(Guid invoiceId, AuditActionType actionType, string performedBy, string details, CancellationToken cancellationToken)
    {
        var entry = eventFactory.Create(invoiceId, actionType, performedBy, details);
        await auditRepository.AddAsync(entry, cancellationToken);
    }
}
