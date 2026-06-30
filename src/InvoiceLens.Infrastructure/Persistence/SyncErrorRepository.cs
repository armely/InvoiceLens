namespace InvoiceLens.Infrastructure.Persistence;

public class SyncErrorRepository
{
    private readonly List<string> _errors = [];

    public Task AddAsync(string message, CancellationToken cancellationToken)
    {
        _errors.Add(message);
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<string>> GetAllAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult<IReadOnlyList<string>>(_errors);
    }
}
