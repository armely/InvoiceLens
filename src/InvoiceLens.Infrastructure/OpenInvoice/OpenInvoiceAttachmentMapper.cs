using System.Text.Json;

namespace InvoiceLens.Infrastructure.OpenInvoice;

public sealed record OpenInvoiceAttachmentListSnapshot(bool CompleteIndicator, int Number, IReadOnlyList<OpenInvoiceAttachmentSnapshot> Attachments);

public static class OpenInvoiceAttachmentMapper
{
    public static OpenInvoiceAttachmentListSnapshot Map(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        var attachments = new List<OpenInvoiceAttachmentSnapshot>();
        if (root.TryGetProperty("attachments", out var attachmentArray))
        {
            foreach (var item in attachmentArray.EnumerateArray())
            {
                attachments.Add(new OpenInvoiceAttachmentSnapshot(
                    item.GetProperty("attachmentId").GetString() ?? string.Empty,
                    item.GetProperty("fileName").GetString() ?? string.Empty,
                    item.GetProperty("contentType").GetString() ?? string.Empty,
                    item.GetProperty("sizeBytes").GetInt64(),
                    item.TryGetProperty("storageFileName", out var storageFileName) ? storageFileName.GetString() : null));
            }
        }

        var meta = root.GetProperty("meta");
        return new OpenInvoiceAttachmentListSnapshot(
            meta.GetProperty("completeIndicator").GetBoolean(),
            meta.GetProperty("number").GetInt32(),
            attachments);
    }
}
