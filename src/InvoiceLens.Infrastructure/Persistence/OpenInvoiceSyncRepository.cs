using Microsoft.Data.SqlClient;

namespace InvoiceLens.Infrastructure.Persistence;

public sealed record OpenInvoicePendingEvent(Guid Id, string? OpenInvoiceDocumentId, string EventType, string PayloadJson, int AttemptCount);

public sealed class OpenInvoiceSyncRepository
{
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
