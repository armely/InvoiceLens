namespace InvoiceLens.Application.Notifications;

public enum NotificationCategory
{
    SystemAlert,
    InvoiceSubmission,
    InvoiceFlagged,
    WorkflowUpdate
}

public enum NotificationSeverity
{
    Info,
    Warning,
    Critical
}

public sealed record NotificationMessage(
    NotificationCategory Category,
    NotificationSeverity Severity,
    string Subject,
    string PlainTextBody,
    IReadOnlyDictionary<string, string>? Metadata = null,
    IReadOnlyList<string>? Recipients = null,
    string? HtmlBody = null);

public interface INotificationService
{
    Task SendAsync(NotificationMessage message, CancellationToken cancellationToken);
}
