namespace InvoiceLens.Infrastructure.Notifications;

public sealed class NotificationOptions
{
    public bool Enabled { get; set; }
    public string TenantId { get; set; } = string.Empty;
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string SenderUserId { get; set; } = string.Empty;
    public string SubjectPrefix { get; set; } = "InvoiceLens";
    public string[] Recipients { get; set; } = [];
}