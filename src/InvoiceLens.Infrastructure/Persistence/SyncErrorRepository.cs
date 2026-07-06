using Microsoft.Data.SqlClient;

namespace InvoiceLens.Infrastructure.Persistence;

public class SyncErrorRepository
{
    public async Task AddAsync(string message, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            var batchId = Guid.NewGuid();

            await using (var batchCommand = connection.CreateCommand())
            {
                batchCommand.Transaction = transaction;
                batchCommand.CommandText = """
                    INSERT INTO dbo.SyncBatch
                        (SyncBatchId, SyncType, StartedAtUtc, FinishedAtUtc, ProcessedCount, FailedCount, Status)
                    VALUES
                        (@SyncBatchId, @SyncType, @StartedAtUtc, @FinishedAtUtc, @ProcessedCount, @FailedCount, @Status);
                    """;
                batchCommand.Parameters.AddWithValue("@SyncBatchId", batchId);
                batchCommand.Parameters.AddWithValue("@SyncType", "Manual");
                batchCommand.Parameters.AddWithValue("@StartedAtUtc", DateTime.UtcNow);
                batchCommand.Parameters.AddWithValue("@FinishedAtUtc", DateTime.UtcNow);
                batchCommand.Parameters.AddWithValue("@ProcessedCount", 0);
                batchCommand.Parameters.AddWithValue("@FailedCount", 1);
                batchCommand.Parameters.AddWithValue("@Status", "Failed");
                await batchCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            await using (var errorCommand = connection.CreateCommand())
            {
                errorCommand.Transaction = transaction;
                errorCommand.CommandText = """
                    INSERT INTO dbo.SyncError
                        (SyncErrorId, SyncBatchId, InvoiceExternalId, ErrorCode, ErrorMessage, OccurredAtUtc, RetryCount)
                    VALUES
                        (@SyncErrorId, @SyncBatchId, NULL, NULL, @ErrorMessage, SYSUTCDATETIME(), 0);
                    """;
                errorCommand.Parameters.AddWithValue("@SyncErrorId", Guid.NewGuid());
                errorCommand.Parameters.AddWithValue("@SyncBatchId", batchId);
                errorCommand.Parameters.AddWithValue("@ErrorMessage", message);
                await errorCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<IReadOnlyList<string>> GetAllAsync(CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT ErrorMessage
            FROM dbo.SyncError
            ORDER BY OccurredAtUtc DESC;
            """;

        var errors = new List<string>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            errors.Add(reader.GetStringValue("ErrorMessage"));
        }

        return errors;
    }
}
