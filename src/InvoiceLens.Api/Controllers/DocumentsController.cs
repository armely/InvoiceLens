using InvoiceLens.Application.Documents;
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

        var contentType = string.IsNullOrWhiteSpace(snapshot.ContentType) || snapshot.ContentType == "application/octet-stream"
            ? "application/pdf"
            : snapshot.ContentType;

        // Serve inline so browsers embed the PDF instead of downloading it.
        Response.Headers.ContentDisposition = $"inline; filename=\"{snapshot.FileName}\"";
        return File(snapshot.Content, contentType);
    }

    [HttpGet("attachments/{attachmentId}")]
    public async Task<IActionResult> GetAttachment(Guid invoiceId, string attachmentId, CancellationToken cancellationToken)
    {
        var attachment = await documentQueries.GetAttachmentAsync(invoiceId, attachmentId, cancellationToken);
        if (attachment is null)
        {
            return NotFound();
        }

        Response.Headers.ContentDisposition = $"inline; filename=\"{attachment.FileName}\"";
        return File(attachment.Content, attachment.ContentType);
    }
}
