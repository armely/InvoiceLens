namespace InvoiceLens.Worker.Jobs;

internal static class RecurringJobRunner
{
    private static readonly TimeSpan FailureRetryDelay = TimeSpan.FromSeconds(30);

    public static async Task RunAsync(
        string jobName,
        TimeSpan successInterval,
        Func<CancellationToken, Task> operation,
        ILogger logger,
        CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var nextDelay = successInterval;
            try
            {
                await operation(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                nextDelay = FailureRetryDelay;
                logger.LogError(
                    exception,
                    "{JobName} failed. The worker remains active and will retry in {RetrySeconds} seconds.",
                    jobName,
                    FailureRetryDelay.TotalSeconds);
            }

            try
            {
                await Task.Delay(nextDelay, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
        }
    }
}
