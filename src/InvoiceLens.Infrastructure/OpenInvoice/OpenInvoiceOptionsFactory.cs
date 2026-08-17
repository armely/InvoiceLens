using Microsoft.Extensions.Configuration;

namespace InvoiceLens.Infrastructure.OpenInvoice;

public static class OpenInvoiceOptionsFactory
{
    public static OpenInvoiceOptions Create(IConfiguration configuration, string defaultHmacSigningKey = "")
    {
        var section = configuration.GetSection("OpenInvoice");
        var options = new OpenInvoiceOptions
        {
            Environment = GetString(section, "Environment", "Mock"),
            BaseUrl = GetString(section, "BaseUrl", "http://localhost:5189"),
            UseMock = GetBool(section, "UseMock", true),
            EnableHmac = GetBool(section, "EnableHmac", true),
            HmacSigningKey = GetString(section, "HmacSigningKey", GetString(section, "HmacKey", defaultHmacSigningKey)),
            MacHeaderName = GetString(section, "MacHeaderName", "mac"),
            CertificateEnabled = GetBool(section, "CertificateEnabled", GetBool(section, "EnableClientCertificate", false)),
            CertificatePath = GetString(section, "CertificatePath", GetString(section, "ClientCertificatePath", string.Empty)),
            CertificatePassword = GetString(section, "CertificatePassword", GetString(section, "ClientCertificatePassword", string.Empty)),
            EnableAllowedIpSimulation = GetBool(section, "EnableAllowedIpSimulation", false),
            CompanyId = GetString(section, "CompanyId", string.Empty),
            BuyerDuns = GetString(section, "BuyerDuns", string.Empty),
            TimeoutSeconds = GetInt(section, "TimeoutSeconds", 660),
            DefaultPageSize = GetInt(section, "DefaultPageSize", 100),
            MaxRetryCount = GetInt(section, "MaxRetryCount", 3),
            RetryDelaySeconds = GetInt(section, "RetryDelaySeconds", 10)
        };

        options.AllowedIps = GetStringArray(section, "AllowedIps", ["127.0.0.1", "::1"]);

        if (options.EnableHmac && string.IsNullOrWhiteSpace(options.HmacSigningKey))
        {
            throw new InvalidOperationException("OpenInvoice HMAC is enabled but no HMAC signing key was configured.");
        }

        if (options.CertificateEnabled && string.IsNullOrWhiteSpace(options.CertificatePath))
        {
            throw new InvalidOperationException("OpenInvoice client certificate is enabled but no certificate path was configured.");
        }

        return options;
    }

    private static string GetString(IConfigurationSection section, string key, string fallback)
    {
        return section[key] ?? fallback;
    }

    private static bool GetBool(IConfigurationSection section, string key, bool fallback)
    {
        return bool.TryParse(section[key], out var value) ? value : fallback;
    }

    private static int GetInt(IConfigurationSection section, string key, int fallback)
    {
        return int.TryParse(section[key], out var value) ? value : fallback;
    }

    private static string[] GetStringArray(IConfigurationSection section, string key, string[] fallback)
    {
        var arraySection = section.GetSection(key);
        var values = arraySection.GetChildren()
            .Select(child => child.Value ?? child.Key)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .ToArray();

        if (values.Length > 0)
        {
            return values!;
        }

        var value = section[key];
        if (string.IsNullOrWhiteSpace(value))
        {
            return fallback;
        }

        var entries = value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return entries.Length == 0 ? fallback : entries;
    }
}
