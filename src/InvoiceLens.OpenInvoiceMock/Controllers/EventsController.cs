using System.Text.Json;
using InvoiceLens.Infrastructure.OpenInvoice;
using InvoiceLens.OpenInvoiceMock;
using InvoiceLens.OpenInvoiceMock.Models;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.OpenInvoiceMock.Controllers;

[ApiController]
public sealed class EventsController(OpenInvoiceMockStore store, OpenInvoiceOptions options) : ControllerBase
{
    private readonly OpenInvoiceOptions _options = options;

    [HttpPost("/docp/events/supply-chain/v1/invoice.exports.set")]
    public async Task<IActionResult> ExportStatus([FromBody] JsonElement payload, CancellationToken cancellationToken)
    {
        var context = payload.GetProperty("context");
        var transform = payload.GetProperty("transform");
        var documentId = context.GetProperty("documentId").GetString() ?? string.Empty;
        var serviceStatus = transform.GetProperty("serviceStatus").GetString() ?? "pending";
        var invoice = store.GetInvoice(documentId);
        if (invoice is null)
        {
            return NotFound(new { messages = new[] { new { type = "error", code = "NOT_FOUND", developerMessage = "Invoice not found." } } });
        }

        await store.UpdateInvoiceAsync(documentId, current =>
        {
            current.ServiceStatus = serviceStatus switch
            {
                "success" => "completed",
                "failure" => "failed",
                "inprogress" => "inprogress",
                _ => current.ServiceStatus
            };
        });

        await store.AppendEventAsync(new OpenInvoiceEventRecord
        {
            EventId = Guid.NewGuid().ToString("N"),
            DocumentId = documentId,
            EventType = "invoice.exports.set",
            PayloadJson = payload.GetRawText(),
            OccurredAtUtc = DateTimeOffset.UtcNow,
            Status = "success"
        });

        return Ok(new { status = "success" });
    }

    [HttpPost("/docp/events/supply-chain/v1/invoice.approve")]
    public async Task<IActionResult> Approve([FromBody] JsonElement payload)
    {
        var documentId = GetDocumentId(payload);
        var comment = GetOptionalComment(payload);
        var invoice = store.GetInvoice(documentId);
        if (invoice is null)
        {
            return NotFound(new { messages = new[] { new { type = "error", code = "NOT_FOUND", developerMessage = "Invoice not found." } } });
        }
        if (invoice.Status is "cancelled" or "deleted")
        {
            return Conflict(new { messages = new[] { new { type = "error", code = "INVALID_WORKFLOW_TRANSITION", developerMessage = "The invoice cannot be approved from the current state." } } });
        }

        await store.UpdateInvoiceAsync(documentId, current =>
        {
            current.Status = "approved";
            current.ServiceType = "approved";
            current.ServiceStatus = "completed";
            current.ApprovedDate ??= DateTimeOffset.UtcNow;
        });

        await store.AppendEventAsync(new OpenInvoiceEventRecord
        {
            EventId = Guid.NewGuid().ToString("N"),
            DocumentId = documentId,
            EventType = "invoice.approve",
            PayloadJson = payload.GetRawText(),
            OccurredAtUtc = DateTimeOffset.UtcNow,
            Status = "success",
            Message = comment
        });

        return Ok(new { status = "approved" });
    }

    [HttpPost("/docp/events/supply-chain/v1/invoice.dispute")]
    public async Task<IActionResult> Dispute([FromBody] JsonElement payload)
    {
        var documentId = GetDocumentId(payload);
        var comment = GetOptionalComment(payload);
        if (string.IsNullOrWhiteSpace(comment))
        {
            return BadRequest(new { messages = new[] { new { type = "error", code = "COMMENT_REQUIRED", developerMessage = "A comment is required to dispute an invoice." } } });
        }

        var invoice = store.GetInvoice(documentId);
        if (invoice is null)
        {
            return NotFound(new { messages = new[] { new { type = "error", code = "NOT_FOUND", developerMessage = "Invoice not found." } } });
        }
        if (invoice.Status is "cancelled" or "deleted")
        {
            return Conflict(new { messages = new[] { new { type = "error", code = "INVALID_WORKFLOW_TRANSITION", developerMessage = "The invoice cannot be disputed from the current state." } } });
        }

        await store.UpdateInvoiceAsync(documentId, current =>
        {
            current.Status = "disputed";
            current.ServiceStatus = "pending";
        });

        await store.AppendEventAsync(new OpenInvoiceEventRecord
        {
            EventId = Guid.NewGuid().ToString("N"),
            DocumentId = documentId,
            EventType = "invoice.dispute",
            PayloadJson = payload.GetRawText(),
            OccurredAtUtc = DateTimeOffset.UtcNow,
            Status = "success",
            Message = comment
        });

        return Ok(new { status = "disputed" });
    }

    [HttpPost("/docp/events/supply-chain/v1/invoice.comment.add")]
    public async Task<IActionResult> Comment([FromBody] JsonElement payload)
    {
        var documentId = GetDocumentId(payload);
        var comment = GetOptionalComment(payload);
        if (string.IsNullOrWhiteSpace(comment))
        {
            return BadRequest(new { messages = new[] { new { type = "error", code = "COMMENT_REQUIRED", developerMessage = "A comment is required." } } });
        }

        await store.AppendEventAsync(new OpenInvoiceEventRecord
        {
            EventId = Guid.NewGuid().ToString("N"),
            DocumentId = documentId,
            EventType = "invoice.comment.add",
            PayloadJson = payload.GetRawText(),
            OccurredAtUtc = DateTimeOffset.UtcNow,
            Status = "success",
            Message = comment
        });

        return Ok(new { status = "commented" });
    }

    [HttpPost("/docp/events/supply-chain/v1/invoice.payment.update")]
    public async Task<IActionResult> PaymentUpdate([FromBody] JsonElement payload)
    {
        await store.AppendEventAsync(new OpenInvoiceEventRecord
        {
            EventId = Guid.NewGuid().ToString("N"),
            DocumentId = GetDocumentId(payload),
            EventType = "invoice.payment.update",
            PayloadJson = payload.GetRawText(),
            OccurredAtUtc = DateTimeOffset.UtcNow,
            Status = "success"
        });

        return Ok(new { status = "payment-updated" });
    }

    [HttpPost("/docp/events/supply-chain/v1/invoice.payment.release")]
    public async Task<IActionResult> PaymentRelease([FromBody] JsonElement payload)
    {
        await store.AppendEventAsync(new OpenInvoiceEventRecord
        {
            EventId = Guid.NewGuid().ToString("N"),
            DocumentId = GetDocumentId(payload),
            EventType = "invoice.payment.release",
            PayloadJson = payload.GetRawText(),
            OccurredAtUtc = DateTimeOffset.UtcNow,
            Status = "success"
        });

        return Ok(new { status = "payment-released" });
    }

    [HttpGet("/docp/events/supply-chain/v1/invoice.approve/meta")]
    [HttpGet("/docp/events/supply-chain/v1/invoice.dispute/meta")]
    [HttpGet("/docp/events/supply-chain/v1/invoice.comment.add/meta")]
    [HttpGet("/docp/events/supply-chain/v1/invoice.exports.set/meta")]
    public IActionResult Meta()
    {
        return Ok(new
        {
            environment = _options.Environment,
            supported = true
        });
    }

    private static string GetDocumentId(JsonElement payload)
    {
        return payload.GetProperty("context").GetProperty("documentId").GetString() ?? string.Empty;
    }

    private static string? GetOptionalComment(JsonElement payload)
    {
        return payload.TryGetProperty("transform", out var transform) && transform.TryGetProperty("comment", out var comment)
            ? comment.GetString()
            : null;
    }
}
