using InvoiceLens.Domain.Entities;
using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Application.Validation;

public static class MsaRateValidation
{
    public static ValidationResult Evaluate(Guid invoiceId, decimal amount, MsaContract? contract)
    {
        if (contract is null)
        {
            return new ValidationResult(
                invoiceId,
                "MSA rate",
                ValidationStatus.Warning,
                ValidationSeverity.Medium,
                "No contract found for vendor",
                DateTimeOffset.UtcNow);
        }

        var ok = amount <= contract.MaxRate;
        return new ValidationResult(
            invoiceId,
            "MSA rate",
            ok ? ValidationStatus.Pass : ValidationStatus.Fail,
            ok ? ValidationSeverity.Info : ValidationSeverity.High,
            ok ? "Within contractual cap" : "Amount exceeds contractual cap",
            DateTimeOffset.UtcNow);
    }
}
