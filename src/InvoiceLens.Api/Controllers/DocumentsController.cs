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

        return File(snapshot.Content, snapshot.ContentType, snapshot.FileName);
    }

    [HttpGet("attachments/{attachmentId}")]
    public async Task<IActionResult> GetAttachment(Guid invoiceId, string attachmentId, CancellationToken cancellationToken)
    {
        var attachment = await documentQueries.GetAttachmentAsync(invoiceId, attachmentId, cancellationToken);
        if (attachment is null)
        {
            return NotFound();
        }

        return File(attachment.Content, attachment.ContentType, attachment.FileName);
    }
}
