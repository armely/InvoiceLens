namespace InvoiceLens.Application.Validation;

public class RunInvoiceValidationCommand(ValidationOrchestrator orchestrator)
{
    public Task<ValidationSummaryDto?> ExecuteAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        return orchestrator.RunValidationAsync(invoiceId, cancellationToken);
    }
}
