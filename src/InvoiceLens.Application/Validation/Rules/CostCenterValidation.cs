using InvoiceLens.Domain.Entities;
using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Application.Validation;

public static class CostCenterValidation
{
    public static ValidationResult Evaluate(Guid invoiceId, string company)
    {
        var ok = !string.IsNullOrWhiteSpace(company);
        return new ValidationResult(
            invoiceId,
            "Cost center",
            ok ? ValidationStatus.Pass : ValidationStatus.Warning,
            ok ? ValidationSeverity.Info : ValidationSeverity.Medium,
            ok ? "Company/cost center mapped" : "Cost center requires review",
            DateTimeOffset.UtcNow);
    }
}
