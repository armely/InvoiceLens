namespace InvoiceLens.Infrastructure.Persistence;

public class SyncCheckpointRepository
{
    private const string SyncType = "OpenInvoice";

    public async Task<DateTimeOffset> GetLastCheckpointAsync(CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT TOP (1) LastRunUtc
            FROM dbo.SyncCheckpoint
            WHERE SyncType = @SyncType
            ORDER BY LastRunUtc DESC, SyncCheckpointId DESC;
            """;
        command.Parameters.AddWithValue("@SyncType", SyncType);

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return result is null || result is DBNull
            ? DateTimeOffset.UtcNow.AddHours(-1)
            : new DateTimeOffset((DateTime)result, TimeSpan.Zero);
    }

    public async Task SaveCheckpointAsync(DateTimeOffset checkpointUtc, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO dbo.SyncCheckpoint (SyncType, LastRunUtc, LastCursor)
            VALUES (@SyncType, @LastRunUtc, NULL);
            """;
        command.Parameters.AddWithValue("@SyncType", SyncType);
        command.Parameters.AddWithValue("@LastRunUtc", checkpointUtc.UtcDateTime);

        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
