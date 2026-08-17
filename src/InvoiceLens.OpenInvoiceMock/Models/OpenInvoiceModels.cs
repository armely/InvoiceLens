using System.Text.Json.Serialization;

namespace InvoiceLens.OpenInvoiceMock.Models;

public sealed record OpenInvoiceInvoiceRecord
{
    public string DocumentId { get; init; } = string.Empty;

    public string InvoiceNumber { get; init; } = string.Empty;

    public string SupplierNumber { get; init; } = string.Empty;

    public string SupplierName { get; init; } = string.Empty;

    public string Status { get; set; } = "submitted";

    public string ServiceType { get; set; } = "submitted";

    public string ServiceStatus { get; set; } = "pending";

    public DateTimeOffset InvoiceDate { get; init; }

    public DateTimeOffset ReceivedDate { get; init; }

    public DateTimeOffset? ApprovedDate { get; set; }

    public string Currency { get; init; } = "USD";

    public decimal Subtotal { get; init; }

    public decimal Tax { get; init; }

    public decimal Total { get; init; }

    public DateTimeOffset LastActionDate { get; set; }

    public List<OpenInvoiceLineItemRecord> LineItems { get; init; } = [];

    public Dictionary<string, string> CodingFields { get; init; } = [];

    public List<OpenInvoiceAttachmentRecord> Attachments { get; init; } = [];

    public string SnapshotFileName { get; init; } = string.Empty;
}

public sealed record OpenInvoiceLineItemRecord
{
    public int LineNumber { get; init; }

    public string? Description { get; init; }

    public decimal Quantity { get; init; }

    public decimal UnitPrice { get; init; }

    public decimal Amount { get; init; }
}

public sealed record OpenInvoiceAttachmentRecord
{
    public string InvoiceDocumentId { get; init; } = string.Empty;

    public string AttachmentId { get; init; } = string.Empty;

    public string FileName { get; init; } = string.Empty;

    public string ContentType { get; init; } = "application/octet-stream";

    public long SizeBytes { get; init; }

    public string StorageFileName { get; init; } = string.Empty;
}

public sealed record OpenInvoiceSupplierRecord
{
    public string SupplierNumber { get; init; } = string.Empty;

    public string SupplierName { get; init; } = string.Empty;
}

public sealed record OpenInvoiceEventRecord
{
    public string EventId { get; init; } = string.Empty;

    public string? DocumentId { get; init; }

    public string EventType { get; init; } = string.Empty;

    public string PayloadJson { get; init; } = string.Empty;

    public string Status { get; set; } = "success";

    public DateTimeOffset OccurredAtUtc { get; init; }

    public string? Message { get; set; }
}

public sealed record OpenInvoiceListMeta(
    bool CompleteIndicator,
    int Number,
    int StartSequence,
    int TotalNumber);

public sealed record OpenInvoiceLink(string Rel, string Href);
