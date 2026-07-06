using InvoiceLens.Application.Audit;
using InvoiceLens.Domain.Entities;

namespace InvoiceLens.Infrastructure.Persistence.Repositories;

public class AuditRepository : IAuditRepository
{
    public async Task AddAsync(AuditEntry entry, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO dbo.AuditEntry
                (AuditEntryId, InvoiceId, ActionType, PerformedBy, Details, OccurredAtUtc)
            VALUES
                (@AuditEntryId, @InvoiceId, @ActionType, @PerformedBy, @Details, @OccurredAtUtc);
            """;
        command.Parameters.AddWithValue("@AuditEntryId", entry.AuditEntryId);
        command.Parameters.AddWithValue("@InvoiceId", entry.InvoiceId);
        command.Parameters.AddWithValue("@ActionType", entry.ActionType.ToString());
        command.Parameters.AddWithValue("@PerformedBy", entry.PerformedBy);
        command.Parameters.AddWithValue("@Details", entry.Details);
        command.Parameters.AddWithValue("@OccurredAtUtc", entry.OccurredAtUtc.UtcDateTime);

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AuditEntry>> GetByInvoiceAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT AuditEntryId, InvoiceId, ActionType, PerformedBy, Details, OccurredAtUtc
            FROM dbo.AuditEntry
            WHERE InvoiceId = @InvoiceId
            ORDER BY OccurredAtUtc DESC;
            """;
        command.Parameters.AddWithValue("@InvoiceId", invoiceId);

        var data = new List<AuditEntry>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            data.Add(new AuditEntry
            {
                AuditEntryId = reader.GetGuidValue("AuditEntryId"),
                InvoiceId = reader.GetGuidValue("InvoiceId"),
                ActionType = Enum.Parse<InvoiceLens.Domain.Enums.AuditActionType>(reader.GetStringValue("ActionType"), ignoreCase: true),
                PerformedBy = reader.GetStringValue("PerformedBy"),
                Details = reader.GetStringValue("Details"),
                OccurredAtUtc = reader.GetDateTimeOffsetValue("OccurredAtUtc")
            });
        }

        return data;
    }
}
