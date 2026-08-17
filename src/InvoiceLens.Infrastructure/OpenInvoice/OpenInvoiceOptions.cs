namespace InvoiceLens.Infrastructure.OpenInvoice;

public sealed class OpenInvoiceOptions
{
    public string Environment { get; set; } = "Mock";

    public string BaseUrl { get; set; } = "http://localhost:5189";

    public bool UseMock { get; set; } = true;

    public bool EnableHmac { get; set; } = true;

    public string HmacKey { get; set; } = string.Empty;

    public string HmacSigningKey
    {
        get => HmacKey;
        set => HmacKey = value;
    }

    public string MacHeaderName { get; set; } = "mac";

    public bool EnableClientCertificate { get; set; }

    public bool CertificateEnabled
    {
        get => EnableClientCertificate;
        set => EnableClientCertificate = value;
    }

    public string ClientCertificatePath { get; set; } = string.Empty;

    public string CertificatePath
    {
        get => ClientCertificatePath;
        set => ClientCertificatePath = value;
    }

    public string ClientCertificatePassword { get; set; } = string.Empty;

    public string CertificatePassword
    {
        get => ClientCertificatePassword;
        set => ClientCertificatePassword = value;
    }

    public bool EnableAllowedIpSimulation { get; set; }

    public string[] AllowedIps { get; set; } = ["127.0.0.1", "::1"];

    public string CompanyId { get; set; } = string.Empty;

    public string BuyerDuns { get; set; } = string.Empty;

    public int TimeoutSeconds { get; set; } = 660;

    public int DefaultPageSize { get; set; } = 100;

    public int MaxRetryCount { get; set; } = 3;

    public int RetryDelaySeconds { get; set; } = 10;
}
