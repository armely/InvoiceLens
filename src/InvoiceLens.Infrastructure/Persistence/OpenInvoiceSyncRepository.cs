using Microsoft.Data.SqlClient;

namespace InvoiceLens.Infrastructure.Persistence;

public sealed record OpenInvoicePendingEvent(Guid Id, string? OpenInvoiceDocumentId, string EventType, string PayloadJson, int AttemptCount);

public sealed class OpenInvoiceSyncRepository
{
    public async Task<IAsyncDisposable?> TryAcquireSyncLockAsync(string environment, CancellationToken cancellationToken)
    {
        var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = "DECLARE @result INT; EXEC @result = sys.sp_getapplock @Resource, 'Exclusive', 'Session', 0; SELECT @result;";
        command.Parameters.AddWithValue("@Resource", $"InvoiceLens:OpenInvoice:{environment}");
        var result = Convert.ToInt32(await command.ExecuteScalarAsync(cancellationToken));
        if (result < 0)
        {
            await connection.DisposeAsync();
            return null;
        }

        return new SqlApplicationLock(connection, $"InvoiceLens:OpenInvoice:{environment}");
    }

    public async Task<(DateTimeOffset? LastCompletedUtc, string? Status, int PendingEvents)> GetOperationalStatusAsync(CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT
                (SELECT TOP (1) CompletedAtUtc FROM dbo.OpenInvoiceSyncRuns WHERE CompletedAtUtc IS NOT NULL ORDER BY CompletedAtUtc DESC),
                (SELECT TOP (1) Status FROM dbo.OpenInvoiceSyncRuns ORDER BY StartedAtUtc DESC),
                (SELECT COUNT(*) FROM dbo.OpenInvoiceEventOutbox WHERE Status IN ('Pending', 'Failed'));
            """;
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);
        DateTimeOffset? completed = reader.IsDBNull(0) ? null : new DateTimeOffset(reader.GetDateTime(0), TimeSpan.Zero);
        var status = reader.IsDBNull(1) ? null : reader.GetString(1);
        return (completed, status, reader.GetInt32(2));
    }

    public async Task<Guid> BeginRunAsync(string environment, string jobName, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var runId = Guid.NewGuid();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO dbo.OpenInvoiceSyncRuns
                (Id, Environment, JobName, StartedAtUtc, Status, RecordsRequested, RecordsImported, RecordsFailed)
            VALUES
                (@Id, @Environment, @JobName, SYSUTCDATETIME(), @Status, 0, 0, 0);
            """;
        command.Parameters.AddWithValue("@Id", runId);
        command.Parameters.AddWithValue("@Environment", environment);
        command.Parameters.AddWithValue("@JobName", jobName);
        command.Parameters.AddWithValue("@Status", "Running");
        await command.ExecuteNonQueryAsync(cancellationToken);
        return runId;
    }

    public async Task CompleteRunAsync(Guid runId, string status, int requested, int imported, int failed, string? errorMessage, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE dbo.OpenInvoiceSyncRuns
            SET CompletedAtUtc = SYSUTCDATETIME(),
                Status = @Status,
                RecordsRequested = @Requested,
                RecordsImported = @Imported,
                RecordsFailed = @Failed,
                ErrorMessage = @ErrorMessage
            WHERE Id = @Id;
            """;
        command.Parameters.AddWithValue("@Id", runId);
        command.Parameters.AddWithValue("@Status", status);
        command.Parameters.AddWithValue("@Requested", requested);
        command.Parameters.AddWithValue("@Imported", imported);
        command.Parameters.AddWithValue("@Failed", failed);
        command.Parameters.AddWithValue("@ErrorMessage", (object?)errorMessage ?? DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task SaveCursorAsync(string environment, string serviceType, DateTimeOffset lastSuccessfulSyncUtc, string? lastResourceSetId, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            MERGE dbo.OpenInvoiceSyncCursors AS target
            USING (SELECT @Environment AS Environment, @ServiceType AS ServiceType) AS source
            ON target.Environment = source.Environment AND target.ServiceType = source.ServiceType
            WHEN MATCHED THEN
                UPDATE SET LastSuccessfulSyncUtc = @LastSuccessfulSyncUtc,
                           LastResourceSetId = @LastResourceSetId,
                           UpdatedAtUtc = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (Id, Environment, ServiceType, LastSuccessfulSyncUtc, LastResourceSetId, UpdatedAtUtc)
                VALUES (@Id, @Environment, @ServiceType, @LastSuccessfulSyncUtc, @LastResourceSetId, SYSUTCDATETIME());
            """;
        command.Parameters.AddWithValue("@Id", Guid.NewGuid());
        command.Parameters.AddWithValue("@Environment", environment);
        command.Parameters.AddWithValue("@ServiceType", serviceType);
        command.Parameters.AddWithValue("@LastSuccessfulSyncUtc", lastSuccessfulSyncUtc.UtcDateTime);
        command.Parameters.AddWithValue("@LastResourceSetId", (object?)lastResourceSetId ?? DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task SaveRawDocumentAsync(
        string openInvoiceDocumentId,
        string documentType,
        string sourceEndpoint,
        string contentType,
        string? contentEncoding,
        byte[] rawBody,
        CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO dbo.OpenInvoiceRawDocuments
                (Id, OpenInvoiceDocumentId, DocumentType, SourceEndpoint, ContentType, ContentEncoding, RawBody, BodyHash, ReceivedAtUtc)
            VALUES
                (@Id, @OpenInvoiceDocumentId, @DocumentType, @SourceEndpoint, @ContentType, @ContentEncoding, @RawBody, @BodyHash, SYSUTCDATETIME());
            """;
        command.Parameters.AddWithValue("@Id", Guid.NewGuid());
        command.Parameters.AddWithValue("@OpenInvoiceDocumentId", openInvoiceDocumentId);
        command.Parameters.AddWithValue("@DocumentType", documentType);
        command.Parameters.AddWithValue("@SourceEndpoint", sourceEndpoint);
        command.Parameters.AddWithValue("@ContentType", contentType);
        command.Parameters.AddWithValue("@ContentEncoding", (object?)contentEncoding ?? DBNull.Value);
        command.Parameters.AddWithValue("@RawBody", rawBody);
        command.Parameters.AddWithValue("@BodyHash", Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(rawBody)));
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task ApplyRetentionAsync(int rawDocumentDays, int operationalHistoryDays, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            DELETE FROM dbo.OpenInvoiceRawDocuments
            WHERE ReceivedAtUtc < DATEADD(DAY, -@RawDocumentDays, SYSUTCDATETIME());

            DELETE FROM dbo.OpenInvoiceSyncRuns
            WHERE StartedAtUtc < DATEADD(DAY, -@OperationalHistoryDays, SYSUTCDATETIME());

            DELETE FROM dbo.OpenInvoiceEventOutbox
            WHERE Status = 'Completed'
              AND CompletedAtUtc < DATEADD(DAY, -@OperationalHistoryDays, SYSUTCDATETIME());
            """;
        command.Parameters.AddWithValue("@RawDocumentDays", Math.Max(1, rawDocumentDays));
        command.Parameters.AddWithValue("@OperationalHistoryDays", Math.Max(1, operationalHistoryDays));
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<bool> SaveRawDocumentIfChangedAsync(
        string openInvoiceDocumentId,
        string documentType,
        string sourceEndpoint,
        string contentType,
        string? contentEncoding,
        byte[] rawBody,
        CancellationToken cancellationToken)
    {
        var bodyHash = Convert.ToBase64String(System.Security.Cryptography.SHA256.HashData(rawBody));
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using (var lookup = connection.CreateCommand())
        {
            lookup.CommandText = """
                SELECT TOP (1) BodyHash, ContentType
                FROM dbo.OpenInvoiceRawDocuments
                WHERE OpenInvoiceDocumentId = @OpenInvoiceDocumentId
                  AND DocumentType = @DocumentType
                ORDER BY ReceivedAtUtc DESC;
                """;
            lookup.Parameters.AddWithValue("@OpenInvoiceDocumentId", openInvoiceDocumentId);
            lookup.Parameters.AddWithValue("@DocumentType", documentType);

            await using var reader = await lookup.ExecuteReaderAsync(cancellationToken);
            if (await reader.ReadAsync(cancellationToken) &&
                string.Equals(reader.GetString(0), bodyHash, StringComparison.Ordinal) &&
                string.Equals(reader.GetString(1), contentType, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        await using var insert = connection.CreateCommand();
        insert.CommandText = """
            INSERT INTO dbo.OpenInvoiceRawDocuments
                (Id, OpenInvoiceDocumentId, DocumentType, SourceEndpoint, ContentType, ContentEncoding, RawBody, BodyHash, ReceivedAtUtc)
            VALUES
                (@Id, @OpenInvoiceDocumentId, @DocumentType, @SourceEndpoint, @ContentType, @ContentEncoding, @RawBody, @BodyHash, SYSUTCDATETIME());
            """;
        insert.Parameters.AddWithValue("@Id", Guid.NewGuid());
        insert.Parameters.AddWithValue("@OpenInvoiceDocumentId", openInvoiceDocumentId);
        insert.Parameters.AddWithValue("@DocumentType", documentType);
        insert.Parameters.AddWithValue("@SourceEndpoint", sourceEndpoint);
        insert.Parameters.AddWithValue("@ContentType", contentType);
        insert.Parameters.AddWithValue("@ContentEncoding", (object?)contentEncoding ?? DBNull.Value);
        insert.Parameters.AddWithValue("@RawBody", rawBody);
        insert.Parameters.AddWithValue("@BodyHash", bodyHash);
        await insert.ExecuteNonQueryAsync(cancellationToken);
        return true;
    }

    public async Task EnqueueEventAsync(string openInvoiceDocumentId, string eventType, string payloadJson, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO dbo.OpenInvoiceEventOutbox
                (Id, OpenInvoiceDocumentId, EventType, PayloadJson, Status, AttemptCount, CreatedAtUtc)
            VALUES
                (@Id, @OpenInvoiceDocumentId, @EventType, @PayloadJson, @Status, 0, SYSUTCDATETIME());
            """;
        command.Parameters.AddWithValue("@Id", Guid.NewGuid());
        command.Parameters.AddWithValue("@OpenInvoiceDocumentId", openInvoiceDocumentId);
        command.Parameters.AddWithValue("@EventType", eventType);
        command.Parameters.AddWithValue("@PayloadJson", payloadJson);
        command.Parameters.AddWithValue("@Status", "Pending");
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<OpenInvoicePendingEvent>> GetPendingEventsAsync(CancellationToken cancellationToken, int take = 50)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT TOP (@Take) Id, OpenInvoiceDocumentId, EventType, PayloadJson, AttemptCount
            FROM dbo.OpenInvoiceEventOutbox
            WHERE Status IN ('Pending', 'Failed')
            ORDER BY CreatedAtUtc ASC, AttemptCount ASC;
            """;
        command.Parameters.AddWithValue("@Take", take);

        var events = new List<OpenInvoicePendingEvent>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            events.Add(new OpenInvoicePendingEvent(
                reader.GetGuid(reader.GetOrdinal("Id")),
                reader.IsDBNull(reader.GetOrdinal("OpenInvoiceDocumentId")) ? null : reader.GetString(reader.GetOrdinal("OpenInvoiceDocumentId")),
                reader.GetString(reader.GetOrdinal("EventType")),
                reader.GetString(reader.GetOrdinal("PayloadJson")),
                reader.GetInt32(reader.GetOrdinal("AttemptCount"))));
        }

        return events;
    }

    public async Task MarkEventAttemptAsync(Guid id, string? error, bool completed, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE dbo.OpenInvoiceEventOutbox
            SET AttemptCount = AttemptCount + 1,
                LastAttemptAtUtc = SYSUTCDATETIME(),
                LastError = @LastError,
                Status = @Status,
                CompletedAtUtc = CASE WHEN @Completed = 1 THEN SYSUTCDATETIME() ELSE CompletedAtUtc END
            WHERE Id = @Id;
            """;
        command.Parameters.AddWithValue("@Id", id);
        command.Parameters.AddWithValue("@LastError", (object?)error ?? DBNull.Value);
        command.Parameters.AddWithValue("@Status", completed ? "Completed" : "Failed");
        command.Parameters.AddWithValue("@Completed", completed ? 1 : 0);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}

internal sealed class SqlApplicationLock(SqlConnection connection, string resource) : IAsyncDisposable
{
    public async ValueTask DisposeAsync()
    {
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "EXEC sys.sp_releaseapplock @Resource, 'Session';";
            command.Parameters.AddWithValue("@Resource", resource);
            await command.ExecuteNonQueryAsync();
        }
        finally
        {
            await connection.DisposeAsync();
        }
    }
}
