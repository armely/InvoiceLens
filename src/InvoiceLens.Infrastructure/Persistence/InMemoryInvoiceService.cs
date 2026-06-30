using InvoiceLens.Application.ComplianceQueue;
using InvoiceLens.Application.Invoices;
using InvoiceLens.Application.Sync;
using InvoiceLens.Application.Validation;

namespace InvoiceLens.Infrastructure.Persistence;

public class InMemoryInvoiceService : IInvoiceQueries, IQueueService, IValidationService, ISyncStatusService
{
    private readonly List<InvoiceDetailDto> _invoices =
    [
        new(Guid.Parse("a67ef7b4-1845-4f63-bf48-c45a90bc1ff8"), "INV-1001", "Contoso Energy", "North Ops", "AFE-101", 12450.23m, "USD", "PendingReview"),
        new(Guid.Parse("807e4bfe-e1f1-4ed2-b4f7-0f3c0e95cf31"), "INV-1002", "Fabrikam Services", "South Ops", "AFE-202", 6820.00m, "USD", "PendingReview")
    ];

    public Task<IReadOnlyList<InvoiceSummaryDto>> SearchAsync(string? query, CancellationToken cancellationToken)
    {
        var result = _invoices
            .Where(x => string.IsNullOrWhiteSpace(query)
                || x.InvoiceNumber.Contains(query, StringComparison.OrdinalIgnoreCase)
                || x.Vendor.Contains(query, StringComparison.OrdinalIgnoreCase)
                || x.Company.Contains(query, StringComparison.OrdinalIgnoreCase)
                || x.Afe.Contains(query, StringComparison.OrdinalIgnoreCase))
            .Select(x => new InvoiceSummaryDto(x.InvoiceId, x.InvoiceNumber, x.Vendor, x.Amount, x.Status))
            .ToList();

        return Task.FromResult<IReadOnlyList<InvoiceSummaryDto>>(result);
    }

    public Task<InvoiceDetailDto?> GetDetailAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var invoice = _invoices.FirstOrDefault(x => x.InvoiceId == invoiceId);
        return Task.FromResult(invoice);
    }

    public Task<InvoiceReviewDto?> GetReviewAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var invoice = _invoices.FirstOrDefault(x => x.InvoiceId == invoiceId);
        if (invoice is null)
        {
            return Task.FromResult<InvoiceReviewDto?>(null);
        }

        var review = new InvoiceReviewDto(
            invoice,
            ["Vendor match passed", "Cost center pending confirmation"],
            ["snapshot", "invoice-pdf"]);

        return Task.FromResult<InvoiceReviewDto?>(review);
    }

    public Task<bool> ApproveAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        return UpdateStatusAsync(invoiceId, "Approved");
    }

    public Task<bool> SendBackAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        return UpdateStatusAsync(invoiceId, "SentBack");
    }

    public Task<IReadOnlyList<QueueItemDto>> GetQueueAsync(CancellationToken cancellationToken)
    {
        var items = _invoices
            .Where(x => x.Status is "PendingReview" or "SentBack")
            .Select(x => new QueueItemDto(x.InvoiceId, x.InvoiceNumber, x.Vendor, "Needs analyst review", DateTimeOffset.UtcNow.AddMinutes(-15)))
            .ToList();

        return Task.FromResult<IReadOnlyList<QueueItemDto>>(items);
    }

    public Task<ValidationSummaryDto?> RunValidationAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var invoice = _invoices.FirstOrDefault(x => x.InvoiceId == invoiceId);
        if (invoice is null)
        {
            return Task.FromResult<ValidationSummaryDto?>(null);
        }

        var summary = new ValidationSummaryDto(
            invoiceId,
            "Warning",
            ["Vendor match: Pass", "AFE match: Pass", "Currency check: Pass", "Amount variance: Review"],
            DateTimeOffset.UtcNow);

        return Task.FromResult<ValidationSummaryDto?>(summary);
    }

    public Task<SyncStatusDto> GetStatusAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult(new SyncStatusDto("Healthy", DateTimeOffset.UtcNow.AddMinutes(-25), 3, 0));
    }

    private Task<bool> UpdateStatusAsync(Guid invoiceId, string status)
    {
        var idx = _invoices.FindIndex(x => x.InvoiceId == invoiceId);
        if (idx < 0)
        {
            return Task.FromResult(false);
        }

        _invoices[idx] = _invoices[idx] with { Status = status };
        return Task.FromResult(true);
    }
}
