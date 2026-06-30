namespace InvoiceLens.Worker.Schedules;

public class SyncScheduleOptions
{
    public int IncrementalSyncMinutes { get; set; } = 60;

    public int ReconciliationMinutes { get; set; } = 240;

    public int RetryMinutes { get; set; } = 30;
}
