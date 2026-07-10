using InvoiceLens.Application.Notifications;
using InvoiceLens.Application.Validation;
using InvoiceLens.Infrastructure.OpenInvoice;

namespace InvoiceLens.Infrastructure.Notifications;

public sealed class NotificationMessageFactory
{
    public NotificationMessage CreateNewSubmission(OpenInvoiceInvoiceSnapshot snapshot)
    {
        var subject = $"New invoice submission: {snapshot.InvoiceNumber}";
        var body = string.Join(Environment.NewLine, [
            "A new invoice submission was detected.",
            string.Empty,
            $"Invoice Number: {snapshot.InvoiceNumber}",
            $"Supplier: {snapshot.SupplierName} ({snapshot.SupplierNumber})",
            $"Amount: {snapshot.Currency} {snapshot.Total:N2}",
            $"Status: {snapshot.Status}",
            $"Received: {snapshot.ReceivedDate:yyyy-MM-dd HH:mm:ss 'UTC'}"
        ]);

        return new NotificationMessage(
            NotificationCategory.InvoiceSubmission,
            NotificationSeverity.Info,
            subject,
            body,
            new Dictionary<string, string>
            {
                ["invoiceNumber"] = snapshot.InvoiceNumber,
                ["supplierNumber"] = snapshot.SupplierNumber,
                ["status"] = snapshot.Status,
            });
    }

    public NotificationMessage CreateInvoiceFlagged(Guid invoiceId, ValidationSummaryDto summary)
    {
        var subject = $"Invoice flagged: {invoiceId}";
        var failedCount = summary.Checks.Count(check => check.Status.Equals("Fail", StringComparison.OrdinalIgnoreCase));
        var warningCount = summary.Checks.Count(check => check.Status.Equals("Warning", StringComparison.OrdinalIgnoreCase));

        var body = string.Join(Environment.NewLine, [
            "Validation flagged this invoice for follow-up.",
            string.Empty,
            $"Invoice Id: {invoiceId}",
            $"Overall Status: {summary.OverallStatus}",
            $"Failed Rules: {failedCount}",
            $"Warning Rules: {warningCount}",
            $"Executed At: {summary.ExecutedAt:yyyy-MM-dd HH:mm:ss 'UTC'}"
        ]);

        var severity = failedCount > 0 ? NotificationSeverity.Critical : NotificationSeverity.Warning;

        return new NotificationMessage(
            NotificationCategory.InvoiceFlagged,
            severity,
            subject,
            body,
            new Dictionary<string, string>
            {
                ["invoiceId"] = invoiceId.ToString(),
                ["overallStatus"] = summary.OverallStatus,
                ["failedCount"] = failedCount.ToString(),
                ["warningCount"] = warningCount.ToString(),
            });
    }

    public NotificationMessage CreateWorkflowUpdate(Guid invoiceId, string invoiceNumber, string updateType)
    {
        var subject = $"Invoice workflow update: {invoiceNumber}";
        var body = string.Join(Environment.NewLine, [
            "An invoice workflow status changed in InvoiceLens.",
            string.Empty,
            $"Invoice Id: {invoiceId}",
            $"Invoice Number: {invoiceNumber}",
            $"Update: {updateType}",
            $"Occurred At: {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm:ss 'UTC'}"
        ]);

        return new NotificationMessage(
            NotificationCategory.WorkflowUpdate,
            NotificationSeverity.Info,
            subject,
            body,
            new Dictionary<string, string>
            {
                ["invoiceId"] = invoiceId.ToString(),
                ["invoiceNumber"] = invoiceNumber,
                ["updateType"] = updateType,
            });
    }

    public NotificationMessage CreateSystemAlert(string title, string details, NotificationSeverity severity)
    {
        var subject = $"System alert: {title}";
        var body = string.Join(Environment.NewLine, [
            "InvoiceLens system alert.",
            string.Empty,
            $"Title: {title}",
            $"Severity: {severity}",
            $"Details: {details}",
            $"Occurred At: {DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm:ss 'UTC'}"
        ]);

        return new NotificationMessage(
            NotificationCategory.SystemAlert,
            severity,
            subject,
            body,
            new Dictionary<string, string>
            {
                ["title"] = title,
                ["severity"] = severity.ToString(),
            });
    }
}