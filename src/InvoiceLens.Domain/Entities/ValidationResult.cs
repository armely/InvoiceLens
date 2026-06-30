using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Domain.Entities;

public record ValidationResult(
    Guid InvoiceId,
    string RuleName,
    ValidationStatus Status,
    ValidationSeverity Severity,
    string Message,
    DateTimeOffset ExecutedAtUtc);
