namespace InvoiceLens.Application.Validation;

public record ValidationSummaryDto(Guid InvoiceId, string OverallStatus, IReadOnlyList<string> Checks, DateTimeOffset ExecutedAt);

public interface IValidationService
{
    Task<ValidationSummaryDto?> RunValidationAsync(Guid invoiceId, CancellationToken cancellationToken);
}
