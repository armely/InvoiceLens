using InvoiceLens.Domain.Entities;
using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Application.Validation;

public static class CurrencyValidation
{
    public static ValidationResult Evaluate(Guid invoiceId, string currency)
    {
        var ok = currency.Equals("USD", StringComparison.OrdinalIgnoreCase);
        return new ValidationResult(
            invoiceId,
            "Currency",
            ok ? ValidationStatus.Pass : ValidationStatus.Warning,
            ok ? ValidationSeverity.Info : ValidationSeverity.Medium,
            ok ? "Currency accepted" : $"Currency {currency} requires manual check",
            DateTimeOffset.UtcNow);
    }
}
