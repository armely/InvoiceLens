using InvoiceLens.Domain.Enums;

namespace InvoiceLens.Domain.Entities;

public class Invoice
{
    public Guid InvoiceId { get; set; }

    public string InvoiceNumber { get; set; } = string.Empty;

    public string Vendor { get; set; } = string.Empty;

    public string Company { get; set; } = string.Empty;

    public string Afe { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public string Currency { get; set; } = "USD";

    public InvoiceStatus Status { get; set; } = InvoiceStatus.PendingReview;
}
