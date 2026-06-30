namespace InvoiceLens.Application.Audit;

public class GetAuditTrailQuery(IAuditRepository auditRepository)
{
    public async Task<IReadOnlyList<AuditEntryDto>> ExecuteAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var entries = await auditRepository.GetByInvoiceAsync(invoiceId, cancellationToken);
        return entries
            .OrderByDescending(x => x.OccurredAtUtc)
            .Select(x => new AuditEntryDto(x.AuditEntryId, x.InvoiceId, x.ActionType, x.PerformedBy, x.Details, x.OccurredAtUtc))
            .ToList();
    }
}
