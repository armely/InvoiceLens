using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Domain.Entities;

public record ValidationRule(string RuleName, ValidationSeverity Severity, string Description);
