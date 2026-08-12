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
        foreach (var item in EnumerateAttachmentItems(root))
        {
                var attachmentId = TryGetFirstString(item, "attachmentId", "documentId", "contentId", "cid", "id", "href", "url");
                if (string.IsNullOrWhiteSpace(attachmentId) && item.TryGetProperty("links", out var links) && links.ValueKind == JsonValueKind.Array)
                {
                    foreach (var link in links.EnumerateArray())
                    {
                        if (!link.TryGetProperty("href", out var href) || href.ValueKind != JsonValueKind.String)
                        {
                            continue;
                        }

                        if (TryExtractAttachmentIdFromHref(href.GetString(), out var parsedAttachmentId))
                        {
                            attachmentId = parsedAttachmentId;
                            break;
                        }
                    }
                }

                if (string.IsNullOrWhiteSpace(attachmentId))
                {
                    continue;
                }

                attachmentId = NormalizeAttachmentId(attachmentId);
                var fileName = TryGetFirstString(item, "fileName", "filename", "name", "documentName");
                if (string.IsNullOrWhiteSpace(fileName))
                {
                    fileName = attachmentId;
                }

                var contentType = TryGetFirstString(item, "contentType", "mimeType", "mediaType");
                if (string.IsNullOrWhiteSpace(contentType))
                {
                    contentType = "application/octet-stream";
                }

                var metadata = AttachmentFileMetadataResolver.Resolve(fileName, contentType);

                var sizeBytes = TryGetInt64(item, "sizeBytes") ?? 0;

                attachments.Add(new OpenInvoiceAttachmentSnapshot(
                    attachmentId,
                    metadata.FileName,
                    metadata.ContentType,
                    sizeBytes,
                    item.TryGetProperty("storageFileName", out var storageFileName) && storageFileName.ValueKind == JsonValueKind.String ? storageFileName.GetString() : null));
        }

        var completeIndicator = false;
        var number = attachments.Count;
        if (root.TryGetProperty("meta", out var meta) && meta.ValueKind == JsonValueKind.Object)
        {
            if (meta.TryGetProperty("completeIndicator", out var complete) && (complete.ValueKind == JsonValueKind.True || complete.ValueKind == JsonValueKind.False))
            {
                completeIndicator = complete.GetBoolean();
            }

            if (meta.TryGetProperty("number", out var count) && count.ValueKind == JsonValueKind.Number && count.TryGetInt32(out var parsedCount))
            {
                number = parsedCount;
            }
        }

        return new OpenInvoiceAttachmentListSnapshot(
            completeIndicator,
            number,
            attachments);
    }

    private static IEnumerable<JsonElement> EnumerateAttachmentItems(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in element.EnumerateObject())
            {
                if (property.Value.ValueKind == JsonValueKind.Array &&
                    (property.Name.Contains("attachment", StringComparison.OrdinalIgnoreCase) ||
                     property.Name.Contains("supporting", StringComparison.OrdinalIgnoreCase) ||
                     property.Name.Contains("document", StringComparison.OrdinalIgnoreCase)))
                {
                    foreach (var item in property.Value.EnumerateArray())
                    {
                        if (item.ValueKind == JsonValueKind.Object)
                        {
                            yield return item;
                        }
                        else if (item.ValueKind == JsonValueKind.String)
                        {
                            using var synthetic = JsonDocument.Parse($"{{\"cid\":{JsonSerializer.Serialize(item.GetString())}}}");
                            yield return synthetic.RootElement.Clone();
                        }
                    }
                }

                foreach (var nested in EnumerateAttachmentItems(property.Value))
                {
                    yield return nested;
                }
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                foreach (var nested in EnumerateAttachmentItems(item))
                {
                    yield return nested;
                }
            }
        }
    }

    private static string? TryGetFirstString(JsonElement element, params string[] names)
    {
        foreach (var property in element.EnumerateObject())
        {
            if (names.Any(name => property.Name.Equals(name, StringComparison.OrdinalIgnoreCase)) && property.Value.ValueKind == JsonValueKind.String)
            {
                return property.Value.GetString();
            }
        }

        return null;
    }

    private static string NormalizeAttachmentId(string? value)
    {
        var normalized = value?.Trim() ?? string.Empty;
        if (normalized.StartsWith("cid:", StringComparison.OrdinalIgnoreCase))
        {
            normalized = normalized[4..];
        }

        return TryExtractAttachmentIdFromHref(normalized, out var fromHref) ? fromHref : normalized;
    }

    private static string? TryGetString(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static long? TryGetInt64(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var value) || value.ValueKind != JsonValueKind.Number)
        {
            return null;
        }

        return value.TryGetInt64(out var parsed) ? parsed : null;
    }

    private static bool TryExtractAttachmentIdFromHref(string? href, out string attachmentId)
    {
        attachmentId = string.Empty;
        if (string.IsNullOrWhiteSpace(href))
        {
            return false;
        }

        var path = href;
        if (Uri.TryCreate(href, UriKind.Absolute, out var uri))
        {
            path = uri.AbsolutePath;
        }
        else
        {
            var queryIndex = path.IndexOf('?');
            if (queryIndex >= 0)
            {
                path = path[..queryIndex];
            }
        }

        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        for (var index = 0; index < segments.Length - 1; index++)
        {
            if (!segments[index].Equals("attachments", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var candidate = Uri.UnescapeDataString(segments[index + 1]);
            if (string.IsNullOrWhiteSpace(candidate))
            {
                continue;
            }

            attachmentId = candidate;
            return true;
        }

        return false;
    }
}
