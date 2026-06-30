using InvoiceLens.Domain.Entities;
using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Application.Validation;

public static class AfeValidation
{
    public static ValidationResult Evaluate(Guid invoiceId, string afe)
    {
        var ok = !string.IsNullOrWhiteSpace(afe);
        return new ValidationResult(
            invoiceId,
            "AFE match",
            ok ? ValidationStatus.Pass : ValidationStatus.Warning,
            ok ? ValidationSeverity.Info : ValidationSeverity.Medium,
            ok ? "AFE is present" : "AFE missing or inactive",
            DateTimeOffset.UtcNow);
    }
}
