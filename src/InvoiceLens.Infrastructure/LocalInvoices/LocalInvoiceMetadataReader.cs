using System.Text.Json;

namespace InvoiceLens.Infrastructure.LocalInvoices;

internal sealed class LocalInvoiceMetadataReader
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public async Task<LocalInvoiceMetadata?> ReadAsync(string metadataPath, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(metadataPath) || !File.Exists(metadataPath))
        {
            return null;
        }

        await using var stream = File.OpenRead(metadataPath);
        return await JsonSerializer.DeserializeAsync<LocalInvoiceMetadata>(stream, JsonOptions, cancellationToken);
    }

    public async Task<IReadOnlyList<LocalInvoiceMetadataSnapshot>> ReadAllAsync(string metadataFolder, string pdfFolder, CancellationToken cancellationToken)
    {
        if (!Directory.Exists(metadataFolder))
        {
            return Array.Empty<LocalInvoiceMetadataSnapshot>();
        }

        var metadataFiles = Directory.EnumerateFiles(metadataFolder, "*.json", SearchOption.TopDirectoryOnly)
            .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        var snapshots = new List<LocalInvoiceMetadataSnapshot>(metadataFiles.Length);
        foreach (var metadataPath in metadataFiles)
        {
            var metadata = await ReadAsync(metadataPath, cancellationToken);
            if (metadata is null)
            {
                continue;
            }

            var pdfPath = Path.Combine(pdfFolder, metadata.FileName);
            snapshots.Add(new LocalInvoiceMetadataSnapshot(metadata, metadataPath, pdfPath));
        }

        return snapshots;
    }
}

internal sealed record LocalInvoiceMetadataSnapshot(
    LocalInvoiceMetadata Metadata,
    string MetadataPath,
    string PdfPath);

internal sealed record LocalInvoiceMetadata
{
    public string LocalInvoiceId { get; init; } = string.Empty;

    public string FileName { get; init; } = string.Empty;

    public string InvoiceNumber { get; init; } = string.Empty;

    public string? SupplierNumber { get; init; }

    public string? SupplierName { get; init; }

    public string? InvoiceDate { get; init; }

    public string? PurchaseOrderNumber { get; init; }

    public string? AfeNumber { get; init; }

    public string? CostCenter { get; init; }

    public string? Currency { get; init; }

    public decimal? Subtotal { get; init; }

    public decimal? Tax { get; init; }

    public decimal? TotalAmount { get; init; }

    public string? Status { get; init; }

    public string? ExportStatus { get; init; }

    public string? PaymentStatus { get; init; }

    public IReadOnlyList<LocalInvoiceLineMetadata> LineItems { get; init; } = Array.Empty<LocalInvoiceLineMetadata>();
}

internal sealed record LocalInvoiceLineMetadata
{
    public int LineNumber { get; init; }

    public string? Description { get; init; }

    public decimal Quantity { get; init; }

    public decimal UnitPrice { get; init; }

    public decimal Amount { get; init; }

    public string? Coding { get; init; }
}
