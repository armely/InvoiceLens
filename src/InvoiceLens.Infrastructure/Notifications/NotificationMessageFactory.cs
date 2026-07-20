using System.Net;
using InvoiceLens.Application.Notifications;
using InvoiceLens.Application.Validation;
using InvoiceLens.Infrastructure.OpenInvoice;

namespace InvoiceLens.Infrastructure.Notifications;

public sealed class NotificationMessageFactory
{
    public NotificationMessage CreateNewSubmission(OpenInvoiceInvoiceSnapshot snapshot)
    {
        return CreateStructuredMessage(
            NotificationCategory.InvoiceSubmission,
            NotificationSeverity.Info,
            $"New invoice submission: {snapshot.InvoiceNumber}",
            "A new invoice submission was detected in InvoiceLens.",
            [
                ("Invoice Number", snapshot.InvoiceNumber),
                ("Supplier", $"{snapshot.SupplierName} ({snapshot.SupplierNumber})"),
                ("Amount", $"{snapshot.Currency} {snapshot.Total:N2}"),
                ("Status", snapshot.Status),
                ("Received", $"{snapshot.ReceivedDate:yyyy-MM-dd HH:mm:ss 'UTC'}"),
            ],
            new Dictionary<string, string>
            {
                ["invoiceNumber"] = snapshot.InvoiceNumber,
                ["supplierNumber"] = snapshot.SupplierNumber,
                ["status"] = snapshot.Status,
            });
    }

    public NotificationMessage CreateInvoiceFlagged(Guid invoiceId, ValidationSummaryDto summary)
    {
        var failedCount = summary.Checks.Count(check => check.Status.Equals("Fail", StringComparison.OrdinalIgnoreCase));
        var warningCount = summary.Checks.Count(check => check.Status.Equals("Warning", StringComparison.OrdinalIgnoreCase));
        var severity = failedCount > 0 ? NotificationSeverity.Critical : NotificationSeverity.Warning;

        return CreateStructuredMessage(
            NotificationCategory.InvoiceFlagged,
            severity,
            $"Invoice flagged: {invoiceId}",
            "Validation flagged this invoice for follow-up.",
            [
                ("Invoice Id", invoiceId.ToString()),
                ("Overall Status", summary.OverallStatus),
                ("Failed Rules", failedCount.ToString()),
                ("Warning Rules", warningCount.ToString()),
                ("Executed At", $"{summary.ExecutedAt:yyyy-MM-dd HH:mm:ss 'UTC'}"),
            ],
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
        return CreateStructuredMessage(
            NotificationCategory.WorkflowUpdate,
            NotificationSeverity.Info,
            $"Invoice workflow update: {invoiceNumber}",
            "An invoice workflow status changed in InvoiceLens.",
            [
                ("Invoice Id", invoiceId.ToString()),
                ("Invoice Number", invoiceNumber),
                ("Update", updateType),
                ("Occurred At", $"{DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm:ss 'UTC'}"),
            ],
            new Dictionary<string, string>
            {
                ["invoiceId"] = invoiceId.ToString(),
                ["invoiceNumber"] = invoiceNumber,
                ["updateType"] = updateType,
            });
    }

    public NotificationMessage CreateSystemAlert(string title, string details, NotificationSeverity severity)
    {
        return CreateStructuredMessage(
            NotificationCategory.SystemAlert,
            severity,
            $"System alert: {title}",
            "InvoiceLens system alert.",
            [
                ("Title", title),
                ("Severity", severity.ToString()),
                ("Details", details),
                ("Occurred At", $"{DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm:ss 'UTC'}"),
            ],
            new Dictionary<string, string>
            {
                ["title"] = title,
                ["severity"] = severity.ToString(),
            });
    }

    public NotificationMessage CreateTestEmail(string recipientName, string recipientEmail)
    {
        var label = string.IsNullOrWhiteSpace(recipientName) ? recipientEmail : recipientName;

        return CreateStructuredMessage(
            NotificationCategory.SystemAlert,
            NotificationSeverity.Info,
            "InvoiceLens test email delivery",
            "This is a test message from InvoiceLens. It confirms that the signed-in Microsoft account can receive a polished notification email.",
            [
                ("Recipient", recipientEmail),
                ("Signed-in user", label),
                ("Delivery path", "Microsoft Graph / mail-enabled app registration"),
                ("Generated at", $"{DateTimeOffset.UtcNow:yyyy-MM-dd HH:mm:ss 'UTC'}"),
            ],
            new Dictionary<string, string>
            {
                ["recipientEmail"] = recipientEmail,
                ["recipientName"] = label,
                ["deliveryPath"] = "Microsoft Graph / mail-enabled app registration",
            },
            [recipientEmail],
            "If you did not request this message, no action is required.");
    }

    private static NotificationMessage CreateStructuredMessage(
        NotificationCategory category,
        NotificationSeverity severity,
        string subject,
        string intro,
        IReadOnlyList<(string Label, string Value)> details,
        IReadOnlyDictionary<string, string>? metadata = null,
        IReadOnlyList<string>? recipients = null,
        string? footer = null)
    {
        var plainTextBody = BuildPlainTextBody(intro, details, footer);
        var htmlBody = BuildHtmlBody(subject, intro, details, severity, footer);

        return new NotificationMessage(
            category,
            severity,
            subject,
            plainTextBody,
            metadata,
            recipients,
            htmlBody);
    }

    private static string BuildPlainTextBody(
        string intro,
        IReadOnlyList<(string Label, string Value)> details,
        string? footer)
    {
        var lines = new List<string>
        {
            intro,
            string.Empty,
            "Details"
        };

        foreach (var (label, value) in details)
        {
            lines.Add($"{label}: {value}");
        }

        if (!string.IsNullOrWhiteSpace(footer))
        {
            lines.Add(string.Empty);
            lines.Add(footer.Trim());
        }

        lines.Add(string.Empty);
        lines.Add("InvoiceLens");
        return string.Join(Environment.NewLine, lines);
    }

    private static string BuildHtmlBody(
        string subject,
        string intro,
        IReadOnlyList<(string Label, string Value)> details,
        NotificationSeverity severity,
        string? footer)
    {
        var accentColor = severity switch
        {
            NotificationSeverity.Info => "#2563eb",
            NotificationSeverity.Warning => "#d97706",
            NotificationSeverity.Critical => "#dc2626",
            _ => "#0f172a"
        };

        var badgeBackground = severity switch
        {
            NotificationSeverity.Info => "#dbeafe",
            NotificationSeverity.Warning => "#fef3c7",
            NotificationSeverity.Critical => "#fee2e2",
            _ => "#e2e8f0"
        };

        var badgeForeground = severity switch
        {
            NotificationSeverity.Info => "#1d4ed8",
            NotificationSeverity.Warning => "#b45309",
            NotificationSeverity.Critical => "#b91c1c",
            _ => "#334155"
        };

        var rows = string.Join(string.Empty, details.Select(detail => $$"""
          <tr>
            <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;width:36%;color:#64748b;font-size:13px;font-weight:600;vertical-align:top;">{{WebUtility.HtmlEncode(detail.Label)}}</td>
            <td style="padding:14px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:14px;line-height:1.6;">{{WebUtility.HtmlEncode(detail.Value)}}</td>
          </tr>
        """));

        var footerBlock = string.IsNullOrWhiteSpace(footer)
            ? string.Empty
            : $$"""
              <tr>
                <td style="padding:0 36px 28px;">
                  <div style="margin:0;padding:16px 18px;border-radius:12px;background:#f8fafc;color:#475569;font-size:13px;line-height:1.6;">{{WebUtility.HtmlEncode(footer.Trim())}}</div>
                </td>
              </tr>
            """;

        return $$"""
            <!doctype html>
            <html lang="en">
            <body style="margin:0;padding:0;background:#f4f7fb;color:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f4f7fb;">
                <tr>
                  <td align="center" style="padding:32px 16px;">
                    <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="border-collapse:separate;background:#ffffff;border:1px solid #e2e8f0;border-radius:18px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,0.08);">
                      <tr>
                        <td style="padding:30px 36px 20px;border-top:5px solid {{accentColor}};">
                          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#64748b;font-weight:700;">InvoiceLens</div>
                          <div style="margin-top:12px;display:inline-block;padding:6px 10px;border-radius:999px;background:{{badgeBackground}};color:{{badgeForeground}};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;">{{WebUtility.HtmlEncode(severity.ToString())}}</div>
                          <h1 style="margin:16px 0 0;font-size:26px;line-height:1.25;color:#0f172a;font-weight:700;">{{WebUtility.HtmlEncode(subject)}}</h1>
                          <p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#334155;">{{WebUtility.HtmlEncode(intro)}}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 36px 6px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                            {{rows}}
                          </table>
                        </td>
                      </tr>
                      {{footerBlock}}
                      <tr>
                        <td style="padding:0 36px 30px;color:#94a3b8;font-size:12px;line-height:1.6;">
                          Sent by InvoiceLens
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """;
    }
}
