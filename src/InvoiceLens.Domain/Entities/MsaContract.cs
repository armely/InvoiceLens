namespace InvoiceLens.Domain.Entities;

public class MsaContract
{
    public Guid ContractId { get; set; }

    public string Vendor { get; set; } = string.Empty;

    public decimal MaxRate { get; set; }

    public string Currency { get; set; } = "USD";

    public DateOnly EffectiveFrom { get; set; }

    public DateOnly? EffectiveTo { get; set; }
}
