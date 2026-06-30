using InvoiceLens.Application.Validation;
using InvoiceLens.Domain.Entities;

namespace InvoiceLens.Infrastructure.Persistence.Repositories;

public class MsaContractRepository : IMsaContractRepository
{
    private readonly List<MsaContract> _contracts =
    [
        new()
        {
            ContractId = Guid.Parse("89233314-f1aa-4214-a646-d532f8ed5f17"),
            Vendor = "Contoso Energy",
            MaxRate = 15000m,
            Currency = "USD",
            EffectiveFrom = new DateOnly(2025, 1, 1)
        },
        new()
        {
            ContractId = Guid.Parse("ad6ea580-66cf-468e-8fca-9ea27ff7f779"),
            Vendor = "Fabrikam Services",
            MaxRate = 7000m,
            Currency = "USD",
            EffectiveFrom = new DateOnly(2025, 1, 1)
        }
    ];

    public Task<MsaContract?> GetForVendorAsync(string vendor, CancellationToken cancellationToken)
    {
        var contract = _contracts.FirstOrDefault(x => x.Vendor.Equals(vendor, StringComparison.OrdinalIgnoreCase));
        return Task.FromResult(contract);
    }
}
