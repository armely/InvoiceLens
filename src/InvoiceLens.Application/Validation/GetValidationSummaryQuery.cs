namespace InvoiceLens.Application.Validation;

public class GetValidationSummaryQuery(ValidationOrchestrator orchestrator)
{
    public Task<ValidationSummaryDto?> ExecuteAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        return orchestrator.GetValidationSummaryAsync(invoiceId, cancellationToken);
    }
}
