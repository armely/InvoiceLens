using InvoiceLens.Domain.Entities;
using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Application.Validation;

public static class AmountVarianceValidation
{
    public static ValidationResult Evaluate(Guid invoiceId, decimal amount)
    {
        var status = amount > 10000m ? ValidationStatus.Warning : ValidationStatus.Pass;
        return new ValidationResult(
            invoiceId,
            "Amount variance",
            status,
            status == ValidationStatus.Pass ? ValidationSeverity.Info : ValidationSeverity.Medium,
            status == ValidationStatus.Pass ? "Amount in expected range" : "Amount above warning threshold",
            DateTimeOffset.UtcNow);
    }
}
