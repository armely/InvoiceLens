using InvoiceLens.Application.Documents;
using InvoiceLens.Infrastructure.OpenInvoice;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.Api.Controllers;

[ApiController]
[Route("api/invoices/{invoiceId:guid}")]
public class DocumentsController(IDocumentQueries documentQueries) : ControllerBase
{
    [HttpGet("snapshot")]
    public async Task<IActionResult> GetSnapshot(Guid invoiceId, CancellationToken cancellationToken)
    {
        var snapshot = await documentQueries.GetSnapshotAsync(invoiceId, cancellationToken);
        if (snapshot is null)
        {
            return NotFound();
        }

        var contentType = ResolveResponseContentType(snapshot.FileName, snapshot.ContentType);
        var metadata = AttachmentFileMetadataResolver.Resolve(snapshot.FileName, contentType);

        // Serve inline so browsers embed the PDF instead of downloading it.
        Response.Headers.ContentDisposition = $"inline; filename=\"{metadata.FileName}\"";
        return File(snapshot.Content, metadata.ContentType);
    }

    [HttpGet("attachments/{attachmentId}")]
    public async Task<IActionResult> GetAttachment(Guid invoiceId, string attachmentId, CancellationToken cancellationToken)
    {
        var attachment = await documentQueries.GetAttachmentAsync(invoiceId, attachmentId, cancellationToken);
        if (attachment is null)
        {
            return NotFound();
        }

        var contentType = ResolveResponseContentType(attachment.FileName, attachment.ContentType);
        var metadata = AttachmentFileMetadataResolver.Resolve(attachment.FileName, contentType);

        Response.Headers.ContentDisposition = $"inline; filename=\"{metadata.FileName}\"";
        return File(attachment.Content, metadata.ContentType);
    }

    private static string ResolveResponseContentType(string? fileName, string? contentType)
    {
        if (!string.IsNullOrWhiteSpace(contentType) && !string.Equals(contentType, "application/octet-stream", StringComparison.OrdinalIgnoreCase))
        {
            return contentType;
        }

        var extension = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
        return extension switch
        {
            ".pdf" => "application/pdf",
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".gif" => "image/gif",
            ".txt" => "text/plain",
            ".csv" => "text/csv",
            ".json" => "application/json",
            ".xml" => "application/xml",
            ".html" => "text/html",
            ".xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xls" => "application/vnd.ms-excel",
            ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".doc" => "application/msword",
            _ => string.IsNullOrWhiteSpace(contentType) ? "application/octet-stream" : contentType,
        };
    }
}
