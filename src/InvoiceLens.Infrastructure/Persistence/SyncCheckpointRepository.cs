namespace InvoiceLens.Infrastructure.Persistence;

public class SyncCheckpointRepository
{
    private DateTimeOffset _lastCheckpointUtc = DateTimeOffset.UtcNow.AddHours(-1);

    public Task<DateTimeOffset> GetLastCheckpointAsync(CancellationToken cancellationToken)
    {
        return Task.FromResult(_lastCheckpointUtc);
    }

    public Task SaveCheckpointAsync(DateTimeOffset checkpointUtc, CancellationToken cancellationToken)
    {
        _lastCheckpointUtc = checkpointUtc;
        return Task.CompletedTask;
    }
}
