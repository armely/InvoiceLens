using Microsoft.Data.SqlClient;

namespace InvoiceLens.Infrastructure.Persistence;

public sealed class DatabaseSchemaException(string message, Exception? innerException = null) : Exception(message, innerException);

public sealed class DataStoreUnavailableException(string message, Exception? innerException = null) : Exception(message, innerException);

internal static class SqlFailureHandling
{
    private static readonly HashSet<int> SchemaErrorNumbers = [207, 208, 2812, 4902];

    public static bool IsSchemaError(SqlException exception)
    {
        if (SchemaErrorNumbers.Contains(exception.Number))
        {
            return true;
        }

        return exception.Message.Contains("Invalid object name", StringComparison.OrdinalIgnoreCase)
            || exception.Message.Contains("Invalid column name", StringComparison.OrdinalIgnoreCase)
            || exception.Message.Contains("Cannot find the object", StringComparison.OrdinalIgnoreCase)
            || exception.Message.Contains("Could not find stored procedure", StringComparison.OrdinalIgnoreCase);
    }

    public static Exception CreateException(SqlException exception, string operation)
    {
        return IsSchemaError(exception)
            ? new DatabaseSchemaException($"The database schema required for {operation} is not initialized.", exception)
            : new DataStoreUnavailableException($"The data store is currently unavailable while {operation}.", exception);
    }
}