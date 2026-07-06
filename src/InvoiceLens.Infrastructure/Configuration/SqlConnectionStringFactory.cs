namespace InvoiceLens.Infrastructure.Configuration;

public static class SqlConnectionStringFactory
{
    public static string Build()
    {
        var serverHost = GetRequired("InvoiceLens__Sql__ServerHost");
        var databaseName = GetRequired("InvoiceLens__Sql__DatabaseName");
        var username = GetRequired("InvoiceLens__Sql__Username");
        var password = GetRequired("InvoiceLens__Sql__Password");
        var encrypt = GetBoolean("InvoiceLens__Sql__Encrypt", defaultValue: true);
        var trustServerCertificate = GetBoolean("InvoiceLens__Sql__TrustServerCertificate", defaultValue: false);

        return $"Server={serverHost};Database={databaseName};User Id={username};Password={password};Encrypt={encrypt};TrustServerCertificate={trustServerCertificate};Connect Timeout=30;Application Name=InvoiceLens";
    }

    private static string GetRequired(string key)
    {
        var value = Environment.GetEnvironmentVariable(key);
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new InvalidOperationException($"Missing required SQL configuration value: {key}");
        }

        return value;
    }

    private static bool GetBoolean(string key, bool defaultValue)
    {
        var value = Environment.GetEnvironmentVariable(key);
        return string.IsNullOrWhiteSpace(value) ? defaultValue : bool.Parse(value);
    }
}
