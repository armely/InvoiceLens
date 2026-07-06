namespace InvoiceLens.Application.Validation;

public record ValidationCheckDto(string RuleName, string Status, string Severity, string Message);

public record ValidationSummaryDto(Guid InvoiceId, string OverallStatus, IReadOnlyList<ValidationCheckDto> Checks, DateTimeOffset ExecutedAt);

public interface IValidationService
{
    Task<ValidationSummaryDto?> RunValidationAsync(Guid invoiceId, CancellationToken cancellationToken);
}
