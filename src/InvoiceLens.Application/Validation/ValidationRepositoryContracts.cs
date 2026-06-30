using InvoiceLens.Domain.Entities;

namespace InvoiceLens.Application.Validation;

public interface IValidationRepository
{
    Task SaveAsync(IReadOnlyList<ValidationResult> results, CancellationToken cancellationToken);

    Task<IReadOnlyList<ValidationResult>> GetByInvoiceAsync(Guid invoiceId, CancellationToken cancellationToken);
}

public interface IMsaContractRepository
{
    Task<MsaContract?> GetForVendorAsync(string vendor, CancellationToken cancellationToken);
}
