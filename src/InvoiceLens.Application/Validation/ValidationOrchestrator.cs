using InvoiceLens.Application.Invoices;
using InvoiceLens.Domain.Entities;
using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Application.Validation;

public class ValidationOrchestrator(IInvoiceQueries invoiceQueries, IValidationRepository validationRepository, IMsaContractRepository msaContractRepository) : IValidationService
{
    public async Task<ValidationSummaryDto?> RunValidationAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var invoice = await invoiceQueries.GetDetailAsync(invoiceId, cancellationToken);
        if (invoice is null)
        {
            return null;
        }

        var results = new List<ValidationResult>
        {
            VendorMatchValidation.Evaluate(invoiceId, invoice.Vendor),
            AfeValidation.Evaluate(invoiceId, invoice.Afe),
            CostCenterValidation.Evaluate(invoiceId, invoice.Company),
            CurrencyValidation.Evaluate(invoiceId, invoice.Currency),
            AmountVarianceValidation.Evaluate(invoiceId, invoice.Amount)
        };

        var contract = await msaContractRepository.GetForVendorAsync(invoice.Vendor, cancellationToken);
        results.Add(MsaRateValidation.Evaluate(invoiceId, invoice.Amount, contract));

        await validationRepository.SaveAsync(results, cancellationToken);

        var overall = results.Any(r => r.Status == ValidationStatus.Fail)
            ? "Fail"
            : results.Any(r => r.Status == ValidationStatus.Warning)
                ? "Warning"
                : "Pass";

        var checks = results
            .Select(r => $"{r.RuleName}: {r.Status} ({r.Message})")
            .ToList();

        return new ValidationSummaryDto(invoiceId, overall, checks, DateTimeOffset.UtcNow);
    }

    public async Task<ValidationSummaryDto?> GetValidationSummaryAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var results = await validationRepository.GetByInvoiceAsync(invoiceId, cancellationToken);
        if (results.Count == 0)
        {
            return null;
        }

        var overall = results.Any(r => r.Status == ValidationStatus.Fail)
            ? "Fail"
            : results.Any(r => r.Status == ValidationStatus.Warning)
                ? "Warning"
                : "Pass";

        var checks = results.Select(r => $"{r.RuleName}: {r.Status} ({r.Message})").ToList();
        return new ValidationSummaryDto(invoiceId, overall, checks, results.Max(x => x.ExecutedAtUtc));
    }
}
