using InvoiceLens.Application.Audit;
using InvoiceLens.Domain.Entities;

namespace InvoiceLens.Infrastructure.Persistence.Repositories;

public class AuditRepository : IAuditRepository
{
    private readonly List<AuditEntry> _entries = [];

    public Task AddAsync(AuditEntry entry, CancellationToken cancellationToken)
    {
        _entries.Add(entry);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<AuditEntry>> GetByInvoiceAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var data = _entries.Where(x => x.InvoiceId == invoiceId).ToList();
        return Task.FromResult<IReadOnlyList<AuditEntry>>(data);
    }
}
