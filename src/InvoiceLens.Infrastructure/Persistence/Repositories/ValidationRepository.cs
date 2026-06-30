using InvoiceLens.Application.Validation;
using InvoiceLens.Domain.Entities;

namespace InvoiceLens.Infrastructure.Persistence.Repositories;

public class ValidationRepository : IValidationRepository
{
    private readonly List<ValidationResult> _results = [];

    public Task SaveAsync(IReadOnlyList<ValidationResult> results, CancellationToken cancellationToken)
    {
        _results.RemoveAll(x => x.InvoiceId == results.First().InvoiceId);
        _results.AddRange(results);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<ValidationResult>> GetByInvoiceAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var data = _results.Where(x => x.InvoiceId == invoiceId).ToList();
        return Task.FromResult<IReadOnlyList<ValidationResult>>(data);
    }
}
