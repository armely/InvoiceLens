namespace InvoiceLens.Infrastructure.LocalInvoices;

public sealed class LocalInvoiceComparisonOptions
{
    public bool Enabled { get; init; } = true;

    public string PdfFolder { get; init; } = "samples/invoices/pdf";

    public string MetadataFolder { get; init; } = "samples/invoices/metadata";

    public bool AutoCompareOnStartup { get; init; }

    public decimal AmountTolerance { get; init; } = 0.01m;

    public int DateToleranceDays { get; init; }

    public bool RequireSupplierNumber { get; init; } = true;
}
