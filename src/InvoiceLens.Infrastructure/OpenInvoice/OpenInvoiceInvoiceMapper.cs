using System.Xml.Linq;

namespace InvoiceLens.Infrastructure.OpenInvoice;

public sealed record OpenInvoiceInvoiceSnapshot(
    string DocumentId,
    string InvoiceNumber,
    string SupplierNumber,
    string SupplierName,
    string Status,
    string ServiceType,
    string ServiceStatus,
    DateTimeOffset InvoiceDate,
    DateTimeOffset ReceivedDate,
    DateTimeOffset? ApprovedDate,
    string Currency,
    decimal Subtotal,
    decimal Tax,
    decimal Total,
    DateTimeOffset LastActionDate,
    IReadOnlyList<OpenInvoiceLineItemSnapshot> LineItems,
    IReadOnlyDictionary<string, string> CodingFields,
    IReadOnlyList<OpenInvoiceAttachmentSnapshot> Attachments);

public sealed record OpenInvoiceLineItemSnapshot(int LineNumber, string? Description, decimal Quantity, decimal UnitPrice, decimal Amount);

public sealed record OpenInvoiceAttachmentSnapshot(string AttachmentId, string FileName, string ContentType, long SizeBytes, string? StorageFileName);

public static class OpenInvoiceInvoiceMapper
{
    public static OpenInvoiceInvoiceSnapshot Map(XDocument document)
    {
        var root = document.Root ?? throw new InvalidOperationException("Invoice XML did not contain a root element.");

        return new OpenInvoiceInvoiceSnapshot(
            GetString(root, "documentId"),
            GetString(root, "invoiceNumber"),
            GetString(root, "supplierNumber"),
            GetString(root, "supplierName"),
            GetString(root, "status"),
            GetString(root, "serviceType"),
            GetString(root, "serviceStatus"),
            GetDateTimeOffset(root, "invoiceDate"),
            GetDateTimeOffset(root, "receivedDate"),
            GetNullableDateTimeOffset(root, "approvedDate"),
            GetString(root, "currency"),
            GetDecimal(root, "subtotal"),
            GetDecimal(root, "tax"),
            GetDecimal(root, "total"),
            GetDateTimeOffset(root, "lastActionDate"),
            root.Element("lineItems")?.Elements("lineItem").Select(MapLineItem).ToArray() ?? [],
            root.Element("codingFields")?.Elements("field").Where(field => !string.IsNullOrWhiteSpace(field.Attribute("name")?.Value)).ToDictionary(field => field.Attribute("name")!.Value, field => field.Value) ?? new Dictionary<string, string>(),
            root.Descendants()
                .Where(element => element.Name.LocalName.Equals("attachment", StringComparison.OrdinalIgnoreCase) ||
                                  element.Name.LocalName.Equals("supportingDocument", StringComparison.OrdinalIgnoreCase))
                .Select(MapAttachment)
                .Where(attachment => !string.IsNullOrWhiteSpace(attachment.AttachmentId))
                .GroupBy(attachment => attachment.AttachmentId, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .ToArray());
    }

    private static OpenInvoiceLineItemSnapshot MapLineItem(XElement element)
    {
        return new OpenInvoiceLineItemSnapshot(
            GetInt(element, "lineNumber"),
            GetNullableString(element, "description"),
            GetDecimal(element, "quantity"),
            GetDecimal(element, "unitPrice"),
            GetDecimal(element, "amount"));
    }

    private static OpenInvoiceAttachmentSnapshot MapAttachment(XElement element)
    {
        var rawId = GetFirstValue(element, "attachmentId", "documentId", "contentId", "cid", "id", "href");
        var attachmentId = rawId.StartsWith("cid:", StringComparison.OrdinalIgnoreCase) ? rawId[4..] : rawId;
        var fileName = GetFirstValue(element, "fileName", "filename", "name", "documentName");
        if (string.IsNullOrWhiteSpace(fileName))
        {
            fileName = attachmentId;
        }
        var metadata = AttachmentFileMetadataResolver.Resolve(fileName, GetFirstValue(element, "contentType", "mimeType", "mediaType"));
        return new OpenInvoiceAttachmentSnapshot(
            attachmentId,
            metadata.FileName,
            metadata.ContentType,
            long.TryParse(GetFirstValue(element, "sizeBytes", "size", "contentLength"), out var size) ? size : 0,
            GetNullableString(element, "storageFileName"));
    }

    private static string GetFirstValue(XElement parent, params string[] names)
    {
        return parent.Elements().FirstOrDefault(element => names.Any(name => element.Name.LocalName.Equals(name, StringComparison.OrdinalIgnoreCase)))?.Value
            ?? parent.Attributes().FirstOrDefault(attribute => names.Any(name => attribute.Name.LocalName.Equals(name, StringComparison.OrdinalIgnoreCase)))?.Value
            ?? string.Empty;
    }

    private static string GetString(XElement parent, string name)
    {
        return parent.Element(name)?.Value ?? string.Empty;
    }

    private static string? GetNullableString(XElement parent, string name)
    {
        return parent.Element(name)?.Value;
    }

    private static int GetInt(XElement parent, string name)
    {
        return int.Parse(GetString(parent, name));
    }

    private static long GetLong(XElement parent, string name)
    {
        return long.Parse(GetString(parent, name));
    }

    private static decimal GetDecimal(XElement parent, string name)
    {
        return decimal.Parse(GetString(parent, name), System.Globalization.CultureInfo.InvariantCulture);
    }

    private static DateTimeOffset GetDateTimeOffset(XElement parent, string name)
    {
        return DateTimeOffset.Parse(GetString(parent, name), System.Globalization.CultureInfo.InvariantCulture);
    }

    private static DateTimeOffset? GetNullableDateTimeOffset(XElement parent, string name)
    {
        var value = GetNullableString(parent, name);
        return string.IsNullOrWhiteSpace(value) ? null : DateTimeOffset.Parse(value, System.Globalization.CultureInfo.InvariantCulture);
    }
}
