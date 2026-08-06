namespace InvoiceLens.Application.Invoices;

public record InvoiceSummaryDto(
    Guid InvoiceId,
    string InvoiceNumber,
    string Vendor,
    string Company,
    string Afe,
    decimal Amount,
    string Currency,
    string Status,
    bool HasAttachments,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc);

public record InvoiceContactDto(
    string Name,
    string AddressLine1,
    string? AddressLine2,
    string City,
    string Region,
    string PostalCode,
    string Email,
    string Phone);

public record InvoiceLineItemDto(
    int LineNumber,
    string? Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal Amount);

public record InvoiceTotalsDto(
    decimal Subtotal,
    decimal Tax,
    decimal Discount,
    decimal Total);

public record InvoiceDetailDto(
    Guid InvoiceId,
    string InvoiceNumber,
    string Vendor,
    string Company,
    string Afe,
    decimal Amount,
    string Currency,
    string Status,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset UpdatedAtUtc,
    DateTimeOffset? InvoiceDateUtc,
    DateTimeOffset? DueDateUtc,
    InvoiceContactDto BillTo,
    InvoiceContactDto VendorContact,
    string? PaymentTerms,
    string? Notes,
    InvoiceTotalsDto Totals,
    IReadOnlyList<InvoiceLineItemDto> LineItems);

public record InvoiceAttachmentDto(
    string AttachmentId,
    string FileName,
    string? Url,
    bool IsFallback);

public record InvoiceReviewDto(InvoiceDetailDto Invoice, IReadOnlyList<string> ValidationHighlights, IReadOnlyList<InvoiceAttachmentDto> Attachments);

public interface IInvoiceQueries
{
    Task<IReadOnlyList<InvoiceSummaryDto>> SearchAsync(string? query, CancellationToken cancellationToken);

    Task<InvoiceDetailDto?> GetDetailAsync(Guid invoiceId, CancellationToken cancellationToken);

    Task<InvoiceReviewDto?> GetReviewAsync(Guid invoiceId, CancellationToken cancellationToken);

    Task<bool> ApproveAsync(Guid invoiceId, CancellationToken cancellationToken);

    Task<bool> SendBackAsync(Guid invoiceId, CancellationToken cancellationToken);
}
