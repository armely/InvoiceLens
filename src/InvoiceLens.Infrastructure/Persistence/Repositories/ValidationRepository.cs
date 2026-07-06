using InvoiceLens.Application.Validation;
using InvoiceLens.Domain.Entities;
using InvoiceLens.Domain.Enums;
using Microsoft.Data.SqlClient;

namespace InvoiceLens.Infrastructure.Persistence.Repositories;

public class ValidationRepository : IValidationRepository
{
    public async Task SaveAsync(IReadOnlyList<ValidationResult> results, CancellationToken cancellationToken)
    {
        if (results.Count == 0)
        {
            return;
        }

        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            await using (var deleteCommand = connection.CreateCommand())
            {
                deleteCommand.Transaction = transaction;
                deleteCommand.CommandText = "DELETE FROM dbo.ValidationResult WHERE InvoiceId = @InvoiceId;";
                deleteCommand.Parameters.AddWithValue("@InvoiceId", results[0].InvoiceId);
                await deleteCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            foreach (var result in results)
            {
                await using var insertCommand = connection.CreateCommand();
                insertCommand.Transaction = transaction;
                insertCommand.CommandText = """
                    INSERT INTO dbo.ValidationResult
                        (ValidationResultId, InvoiceId, RuleName, Status, Severity, Message, ExecutedAtUtc)
                    VALUES
                        (@ValidationResultId, @InvoiceId, @RuleName, @Status, @Severity, @Message, @ExecutedAtUtc);
                    """;
                insertCommand.Parameters.AddWithValue("@ValidationResultId", Guid.NewGuid());
                insertCommand.Parameters.AddWithValue("@InvoiceId", result.InvoiceId);
                insertCommand.Parameters.AddWithValue("@RuleName", result.RuleName);
                insertCommand.Parameters.AddWithValue("@Status", result.Status.ToString());
                insertCommand.Parameters.AddWithValue("@Severity", result.Severity.ToString());
                insertCommand.Parameters.AddWithValue("@Message", result.Message);
                insertCommand.Parameters.AddWithValue("@ExecutedAtUtc", result.ExecutedAtUtc.UtcDateTime);
                await insertCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<IReadOnlyList<ValidationResult>> GetByInvoiceAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT InvoiceId, RuleName, Status, Severity, Message, ExecutedAtUtc
            FROM dbo.ValidationResult
            WHERE InvoiceId = @InvoiceId
            ORDER BY ExecutedAtUtc DESC, RuleName ASC;
            """;
        command.Parameters.AddWithValue("@InvoiceId", invoiceId);

        var data = new List<ValidationResult>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            data.Add(new ValidationResult(
                reader.GetGuidValue("InvoiceId"),
                reader.GetStringValue("RuleName"),
                Enum.Parse<ValidationStatus>(reader.GetStringValue("Status"), ignoreCase: true),
                Enum.Parse<ValidationSeverity>(reader.GetStringValue("Severity"), ignoreCase: true),
                reader.GetStringValue("Message"),
                reader.GetDateTimeOffsetValue("ExecutedAtUtc")));
        }

        return data;
    }
}
