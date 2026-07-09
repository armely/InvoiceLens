using Microsoft.Data.SqlClient;

namespace InvoiceLens.Infrastructure.Persistence;

internal static class SqlDataReaderExtensions
{
    public static Guid GetGuidValue(this SqlDataReader reader, string name)
    {
        return reader.GetGuid(reader.GetOrdinal(name));
    }

    public static string GetStringValue(this SqlDataReader reader, string name)
    {
        return reader.GetString(reader.GetOrdinal(name));
    }

    public static string? GetNullableStringValue(this SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    public static decimal GetDecimalValue(this SqlDataReader reader, string name)
    {
        return reader.GetDecimal(reader.GetOrdinal(name));
    }

    public static decimal? GetNullableDecimalValue(this SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : reader.GetDecimal(ordinal);
    }

    public static int GetInt32Value(this SqlDataReader reader, string name)
    {
        return reader.GetInt32(reader.GetOrdinal(name));
    }

    public static bool GetBooleanValue(this SqlDataReader reader, string name)
    {
        return reader.GetBoolean(reader.GetOrdinal(name));
    }

    public static DateTimeOffset GetDateTimeOffsetValue(this SqlDataReader reader, string name)
    {
        return new DateTimeOffset(reader.GetDateTime(reader.GetOrdinal(name)), TimeSpan.Zero);
    }

    public static DateTimeOffset? GetNullableDateTimeOffsetValue(this SqlDataReader reader, string name)
    {
        var ordinal = reader.GetOrdinal(name);
        return reader.IsDBNull(ordinal) ? null : new DateTimeOffset(reader.GetDateTime(ordinal), TimeSpan.Zero);
    }

    public static DateOnly GetDateOnlyValue(this SqlDataReader reader, string name)
    {
        return DateOnly.FromDateTime(reader.GetDateTime(reader.GetOrdinal(name)));
    }
}
