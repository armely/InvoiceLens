using InvoiceLens.Domain.Entities;
using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Application.Validation;

public static class VendorMatchValidation
{
    public static ValidationResult Evaluate(Guid invoiceId, string vendor)
    {
        var ok = !string.IsNullOrWhiteSpace(vendor);
        return new ValidationResult(
            invoiceId,
            "Vendor match",
            ok ? ValidationStatus.Pass : ValidationStatus.Fail,
            ok ? ValidationSeverity.Info : ValidationSeverity.High,
            ok ? "Vendor exists" : "Vendor is missing",
            DateTimeOffset.UtcNow);
    }
}
