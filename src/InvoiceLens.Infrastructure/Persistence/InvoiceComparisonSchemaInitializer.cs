using System.Text;
using Microsoft.Data.SqlClient;

namespace InvoiceLens.Infrastructure.Persistence;

public sealed class InvoiceComparisonSchemaInitializer
{
    private static readonly (string Name, string Definition)[] InvoiceColumnDefinitions =
    [
        ("OpenInvoiceDocumentId", "NVARCHAR(120) NULL"),
        ("InvoiceDateUtc", "DATETIME2 NULL"),
        ("DueDateUtc", "DATETIME2 NULL"),
        ("BillToName", "NVARCHAR(150) NULL"),
        ("BillToAddressLine1", "NVARCHAR(200) NULL"),
        ("BillToAddressLine2", "NVARCHAR(200) NULL"),
        ("BillToCity", "NVARCHAR(100) NULL"),
        ("BillToRegion", "NVARCHAR(50) NULL"),
        ("BillToPostalCode", "NVARCHAR(20) NULL"),
        ("BillToEmail", "NVARCHAR(150) NULL"),
        ("BillToPhone", "NVARCHAR(40) NULL"),
        ("VendorAddressLine1", "NVARCHAR(200) NULL"),
        ("VendorAddressLine2", "NVARCHAR(200) NULL"),
        ("VendorCity", "NVARCHAR(100) NULL"),
        ("VendorRegion", "NVARCHAR(50) NULL"),
        ("VendorPostalCode", "NVARCHAR(20) NULL"),
        ("VendorEmail", "NVARCHAR(150) NULL"),
        ("PaymentTerms", "NVARCHAR(50) NULL"),
        ("Notes", "NVARCHAR(MAX) NULL"),
        ("SubtotalAmount", "DECIMAL(18,2) NULL"),
        ("TaxAmount", "DECIMAL(18,2) NULL"),
        ("DiscountAmount", "DECIMAL(18,2) NULL"),
    ];

    private static readonly string[] SchemaScriptPathCandidates =
    [
        Path.Combine(AppContext.BaseDirectory, "database", "scripts", "create-schema.sql"),
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "database", "scripts", "create-schema.sql")),
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "database", "scripts", "create-schema.sql")),
    ];

    private static readonly string[] SeedScriptPathCandidates =
    [
        Path.Combine(AppContext.BaseDirectory, "database", "scripts", "seed-local-data.sql"),
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "database", "scripts", "seed-local-data.sql")),
        Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "database", "scripts", "seed-local-data.sql")),
    ];

    public async Task EnsureAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await ExecuteScriptAsync(connection, ResolveScriptPath(SchemaScriptPathCandidates, "database/scripts/create-schema.sql"), cancellationToken);
        await EnsureLegacyInvoiceColumnsAsync(connection, cancellationToken);
        await ExecuteScriptAsync(connection, ResolveScriptPath(SeedScriptPathCandidates, "database/scripts/seed-local-data.sql"), cancellationToken);
    }

    private static async Task EnsureLegacyInvoiceColumnsAsync(SqlConnection connection, CancellationToken cancellationToken)
    {
        await using var tableCheck = connection.CreateCommand();
        tableCheck.CommandText = "SELECT CASE WHEN OBJECT_ID('dbo.Invoice', 'U') IS NULL THEN 0 ELSE 1 END;";

        var tableExists = Convert.ToInt32(await tableCheck.ExecuteScalarAsync(cancellationToken)) == 1;
        if (!tableExists)
        {
            return;
        }

        // Older databases can have dbo.Invoice created without later OpenInvoice columns.
        foreach (var (name, definition) in InvoiceColumnDefinitions)
        {
            await AddColumnIfMissingAsync(connection, name, definition, cancellationToken);
        }
    }

    private static async Task AddColumnIfMissingAsync(
        SqlConnection connection,
        string columnName,
        string columnDefinition,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            IF COL_LENGTH('dbo.Invoice', '{columnName}') IS NULL
            BEGIN
                ALTER TABLE dbo.Invoice ADD [{columnName}] {columnDefinition};
            END
            """;

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task ExecuteScriptAsync(SqlConnection connection, string scriptPath, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = await File.ReadAllTextAsync(scriptPath, Encoding.UTF8, cancellationToken);
        command.CommandTimeout = 180;

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string ResolveScriptPath(IEnumerable<string> candidatePaths, string logicalName)
    {
        foreach (var path in candidatePaths.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (File.Exists(path))
            {
                return path;
            }
        }

        throw new FileNotFoundException($"Unable to locate {logicalName} for schema initialization.");
    }
}
