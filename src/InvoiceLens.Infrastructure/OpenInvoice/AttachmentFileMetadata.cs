namespace InvoiceLens.Infrastructure.OpenInvoice;

public sealed record AttachmentFileMetadata(string FileName, string ContentType);

public static class AttachmentFileMetadataResolver
{
    private static readonly IReadOnlyDictionary<string, string> ExtensionsByContentType =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["application/pdf"] = ".pdf",
            ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] = ".xlsx",
            ["application/vnd.ms-excel"] = ".xls",
            ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] = ".docx",
            ["application/msword"] = ".doc",
            ["application/zip"] = ".zip",
            ["image/png"] = ".png",
            ["image/jpeg"] = ".jpg",
            ["image/gif"] = ".gif",
            ["image/webp"] = ".webp",
            ["text/plain"] = ".txt",
            ["text/csv"] = ".csv",
            ["application/json"] = ".json",
            ["application/xml"] = ".xml",
            ["text/xml"] = ".xml",
        };

    public static AttachmentFileMetadata Resolve(
        string? fileName,
        string? contentType,
        ReadOnlySpan<byte> content = default)
    {
        var safeFileName = Path.GetFileName(string.IsNullOrWhiteSpace(fileName) ? "attachment" : fileName.Trim());
        safeFileName = string.Join("_", safeFileName.Split(Path.GetInvalidFileNameChars(), StringSplitOptions.RemoveEmptyEntries));
        if (string.IsNullOrWhiteSpace(safeFileName))
        {
            safeFileName = "attachment";
        }
        var normalizedContentType = NormalizeContentType(contentType);
        var signatureContentType = DetectContentType(content);

        if (signatureContentType is not null &&
            (normalizedContentType == "application/octet-stream" || !IsOfficeZip(normalizedContentType, signatureContentType)))
        {
            normalizedContentType = signatureContentType;
        }

        if (!ExtensionsByContentType.TryGetValue(normalizedContentType, out var expectedExtension))
        {
            return new AttachmentFileMetadata(
                string.IsNullOrWhiteSpace(Path.GetExtension(safeFileName)) ? $"{safeFileName}.bin" : safeFileName,
                normalizedContentType);
        }

        var currentExtension = Path.GetExtension(safeFileName);
        if (!string.Equals(currentExtension, expectedExtension, StringComparison.OrdinalIgnoreCase))
        {
            safeFileName = Path.ChangeExtension(safeFileName, expectedExtension);
        }

        return new AttachmentFileMetadata(safeFileName, normalizedContentType);
    }

    private static string NormalizeContentType(string? contentType)
    {
        var mediaType = contentType?.Split(';', 2)[0].Trim();
        return string.IsNullOrWhiteSpace(mediaType) ? "application/octet-stream" : mediaType;
    }

    private static string? DetectContentType(ReadOnlySpan<byte> content)
    {
        if (content.StartsWith("%PDF-"u8))
        {
            return "application/pdf";
        }

        if (content.StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47 }))
        {
            return "image/png";
        }

        if (content.StartsWith(new byte[] { 0xFF, 0xD8, 0xFF }))
        {
            return "image/jpeg";
        }

        if (content.StartsWith("GIF87a"u8) || content.StartsWith("GIF89a"u8))
        {
            return "image/gif";
        }

        if (content.StartsWith(new byte[] { 0x50, 0x4B, 0x03, 0x04 }))
        {
            return "application/zip";
        }

        return null;
    }

    private static bool IsOfficeZip(string declaredContentType, string signatureContentType)
    {
        return signatureContentType == "application/zip" &&
            (declaredContentType.EndsWith("spreadsheetml.sheet", StringComparison.OrdinalIgnoreCase) ||
             declaredContentType.EndsWith("wordprocessingml.document", StringComparison.OrdinalIgnoreCase));
    }
}
