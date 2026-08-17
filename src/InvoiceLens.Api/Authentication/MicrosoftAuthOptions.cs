namespace InvoiceLens.Api.Authentication;

public sealed class MicrosoftAuthOptions
{
    public string ClientId { get; set; } = string.Empty;

    public string TenantId { get; set; } = string.Empty;
}
