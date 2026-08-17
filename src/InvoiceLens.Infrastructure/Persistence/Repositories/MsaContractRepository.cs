using InvoiceLens.Application.Validation;
using InvoiceLens.Domain.Entities;

namespace InvoiceLens.Infrastructure.Persistence.Repositories;

public class MsaContractRepository : IMsaContractRepository
{
    public async Task<MsaContract?> GetForVendorAsync(string vendor, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT TOP (1) ContractId, Vendor, MaxRate, Currency, EffectiveFrom, EffectiveTo
            FROM dbo.MsaContract
            WHERE Vendor = @Vendor
              AND EffectiveFrom <= CONVERT(date, SYSUTCDATETIME())
              AND (EffectiveTo IS NULL OR EffectiveTo >= CONVERT(date, SYSUTCDATETIME()))
            ORDER BY EffectiveFrom DESC, ContractId ASC;
            """;
        command.Parameters.Add("@Vendor", System.Data.SqlDbType.NVarChar, 150).Value = vendor;

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new MsaContract
        {
            ContractId = reader.GetGuidValue("ContractId"),
            Vendor = reader.GetStringValue("Vendor"),
            MaxRate = reader.GetDecimalValue("MaxRate"),
            Currency = reader.GetStringValue("Currency"),
            EffectiveFrom = reader.GetDateOnlyValue("EffectiveFrom"),
            EffectiveTo = reader.IsDBNull(reader.GetOrdinal("EffectiveTo"))
                ? null
                : DateOnly.FromDateTime(reader.GetDateTime(reader.GetOrdinal("EffectiveTo")))
        };
    }
}
