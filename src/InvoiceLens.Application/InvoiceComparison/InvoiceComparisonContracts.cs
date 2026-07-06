namespace InvoiceLens.Application.InvoiceComparison;

using InvoiceLens.Application.Documents;

public sealed record LocalInvoiceFileDto(
    int LocalInvoiceFileId,
    string FileName,
    string FilePath,
    string? MetadataPath,
    string? InvoiceNumber,
    string? SupplierNumber,
    string? SupplierName,
    decimal? TotalAmount,
    DateTimeOffset LoadedAtUtc,
    DateTimeOffset? LastComparedAtUtc,
    string? LastMatchStatus,
    string? LastOverallStatus,
    decimal? LastMatchScore);

public sealed record InvoiceLineItemDto(
    int LineNumber,
    string? Description,
    decimal Quantity,
    decimal UnitPrice,
    decimal Amount,
    string? Coding);

public sealed record NormalizedInvoice(
    Guid? InvoiceId,
    string InvoiceNumber,
    string? SupplierNumber,
    string? SupplierName,
    DateTimeOffset? InvoiceDate,
    string? PurchaseOrderNumber,
    string? AfeNumber,
    string? CostCenter,
    string? Currency,
    decimal? Subtotal,
    decimal? Tax,
    decimal? TotalAmount,
    string? Status,
    string? ExportStatus,
    string? PaymentStatus,
    IReadOnlyList<InvoiceLineItemDto> LineItems);

public sealed record InvoiceComparisonResultDto(
    string RuleCode,
    string Label,
    string Status,
    string Severity,
    string? LocalValue,
    string? SystemValue,
    string? Message);

public sealed record InvoiceComparisonRunDto(
    int ComparisonRunId,
    LocalInvoiceFileDto LocalInvoiceFile,
    Guid? SystemInvoiceId,
    string MatchStatus,
    string OverallStatus,
    decimal? MatchScore,
    DateTimeOffset CreatedAtUtc,
    NormalizedInvoice? SystemInvoice,
    IReadOnlyList<InvoiceComparisonResultDto> Results);

public interface IInvoiceComparisonService
{
    Task<IReadOnlyList<LocalInvoiceFileDto>> GetLocalInvoicesAsync(CancellationToken cancellationToken);

    Task<int> LoadLocalInvoicesAsync(CancellationToken cancellationToken);

    Task<DocumentStreamResult?> GetLocalInvoicePdfAsync(int localInvoiceFileId, CancellationToken cancellationToken);

    Task<InvoiceComparisonRunDto?> RunComparisonAsync(int localInvoiceFileId, CancellationToken cancellationToken);

    Task<InvoiceComparisonRunDto?> GetComparisonRunAsync(int comparisonRunId, CancellationToken cancellationToken);
}
