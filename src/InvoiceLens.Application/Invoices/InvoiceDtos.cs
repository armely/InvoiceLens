namespace InvoiceLens.Application.Invoices;

public record InvoiceSummaryDto(Guid InvoiceId, string InvoiceNumber, string Vendor, decimal Amount, string Status);

public record InvoiceDetailDto(Guid InvoiceId, string InvoiceNumber, string Vendor, string Company, string Afe, decimal Amount, string Currency, string Status);

public record InvoiceReviewDto(InvoiceDetailDto Invoice, IReadOnlyList<string> ValidationHighlights, IReadOnlyList<string> Attachments);

public interface IInvoiceQueries
{
    Task<IReadOnlyList<InvoiceSummaryDto>> SearchAsync(string? query, CancellationToken cancellationToken);

    Task<InvoiceDetailDto?> GetDetailAsync(Guid invoiceId, CancellationToken cancellationToken);

    Task<InvoiceReviewDto?> GetReviewAsync(Guid invoiceId, CancellationToken cancellationToken);

    Task<bool> ApproveAsync(Guid invoiceId, CancellationToken cancellationToken);

    Task<bool> SendBackAsync(Guid invoiceId, CancellationToken cancellationToken);
}
