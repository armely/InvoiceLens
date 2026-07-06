using System.Text;
using System.Xml.Linq;
using InvoiceLens.Infrastructure.OpenInvoice;
using InvoiceLens.OpenInvoiceMock;
using InvoiceLens.OpenInvoiceMock.Models;
using Microsoft.AspNetCore.Mvc;

namespace InvoiceLens.OpenInvoiceMock.Controllers;

[ApiController]
public sealed class InvoicesController(OpenInvoiceMockStore store, OpenInvoiceOptions options) : ControllerBase
{
    private readonly OpenInvoiceOptions _options = options;

    [HttpGet("/docp/supply-chain/v1/invoices")]
    public IActionResult GetInvoices()
    {
        IReadOnlyList<OpenInvoiceInvoiceRecord> filtered;
        try
        {
            filtered = ApplyFilters(store.GetInvoices(), Request.Query);
        }
        catch (InvalidOperationException exception) when (exception.Message == "UNSUPPORTED_FILTER")
        {
            return BadRequest(new
            {
                messages = new[]
                {
                    new { type = "error", code = "UNSUPPORTED_FILTER", developerMessage = "This simulator does not support the requested filter expression." }
                }
            });
        }

        var skip = TryGetInt("$skip") ?? 0;
        var top = TryGetInt("$top") ?? _options.DefaultPageSize;
        var page = filtered.Skip(skip).Take(top).ToArray();
        var preferHeader = Request.Headers["Prefer"].ToString();
        var acceptHeader = Request.Headers["Accept"].ToString();
        var includeRepresentation = preferHeader.Contains("return=representation", StringComparison.OrdinalIgnoreCase)
            || acceptHeader.Contains("application/xml", StringComparison.OrdinalIgnoreCase);

        var payload = store.BuildListResponse(page, includeRepresentation);
        return includeRepresentation
            ? Content(payload, "application/xml", Encoding.UTF8)
            : Content(payload, "application/json", Encoding.UTF8);
    }

    [HttpGet("/docp/supply-chain/v1/invoices/{invoiceId}")]
    public IActionResult GetInvoice(string invoiceId)
    {
        var invoice = store.GetInvoice(invoiceId);
        if (invoice is null)
        {
            return NotFound(new { messages = new[] { new { type = "error", code = "NOT_FOUND", developerMessage = "Invoice not found." } } });
        }

        if (Request.Headers["Accept"].ToString().Contains("application/xml", StringComparison.OrdinalIgnoreCase))
        {
            return Content(store.BuildInvoiceDocument(invoice).ToString(SaveOptions.DisableFormatting), "application/xml", Encoding.UTF8);
        }

        return Ok(invoice);
    }

    [HttpGet("/docp/supply-chain/v1/invoices/{invoiceId}/attachments")]
    public IActionResult GetAttachments(string invoiceId)
    {
        var invoice = store.GetInvoice(invoiceId);
        if (invoice is null)
        {
            return NotFound();
        }

        return Ok(new
        {
            meta = new { completeIndicator = true, number = invoice.Attachments.Count },
            attachments = invoice.Attachments.Select(attachment => new
            {
                attachmentId = attachment.AttachmentId,
                fileName = attachment.FileName,
                contentType = attachment.ContentType,
                sizeBytes = attachment.SizeBytes,
                links = new[] { new { rel = "self", href = $"/docp/supply-chain/v1/invoices/{invoice.DocumentId}/attachments/{attachment.AttachmentId}" } }
            })
        });
    }

    [HttpGet("/docp/supply-chain/v1/invoices/{invoiceId}/attachments/{attachmentId}")]
    public IActionResult GetAttachment(string invoiceId, string attachmentId)
    {
        var attachment = store.GetAttachments(invoiceId).FirstOrDefault(item => string.Equals(item.AttachmentId, attachmentId, StringComparison.OrdinalIgnoreCase));
        if (attachment is null)
        {
            return NotFound(new { messages = new[] { new { type = "error", code = "NOT_FOUND", developerMessage = "Attachment not found." } } });
        }

        try
        {
            var stream = store.OpenAttachment(attachment);
            return File(stream, attachment.ContentType, attachment.FileName);
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { messages = new[] { new { type = "error", code = "NOT_FOUND", developerMessage = "Attachment not found." } } });
        }
    }

    [HttpGet("/docp/supply-chain/v1/invoices/{invoiceId}/snapshot")]
    public IActionResult GetSnapshot(string invoiceId)
    {
        try
        {
            var stream = store.OpenSnapshot(invoiceId);
            return File(stream, "application/pdf");
        }
        catch (FileNotFoundException)
        {
            return NotFound(new { messages = new[] { new { type = "error", code = "NOT_FOUND", developerMessage = "Snapshot not found." } } });
        }
    }

    private IReadOnlyList<OpenInvoiceInvoiceRecord> ApplyFilters(IReadOnlyList<OpenInvoiceInvoiceRecord> invoices, IQueryCollection query)
    {
        var filter = query.TryGetValue("$filter", out var filterValue) ? filterValue.ToString() : string.Empty;
        if (string.IsNullOrWhiteSpace(filter))
        {
            return invoices;
        }

        var clauses = filter.Split(" and ", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var clause in clauses)
        {
            invoices = clause switch
            {
                var value when value.StartsWith("status eq ", StringComparison.OrdinalIgnoreCase) => invoices.Where(invoice => string.Equals(invoice.Status, ParseValue(value), StringComparison.OrdinalIgnoreCase)).ToArray(),
                var value when value.StartsWith("serviceType eq ", StringComparison.OrdinalIgnoreCase) => invoices.Where(invoice => string.Equals(invoice.ServiceType, ParseValue(value), StringComparison.OrdinalIgnoreCase)).ToArray(),
                var value when value.StartsWith("serviceStatus eq ", StringComparison.OrdinalIgnoreCase) => invoices.Where(invoice => string.Equals(invoice.ServiceStatus, ParseValue(value), StringComparison.OrdinalIgnoreCase)).ToArray(),
                var value when value.StartsWith("invoiceNumber eq ", StringComparison.OrdinalIgnoreCase) => invoices.Where(invoice => string.Equals(invoice.InvoiceNumber, ParseValue(value), StringComparison.OrdinalIgnoreCase)).ToArray(),
                var value when value.StartsWith("supplierNumber eq ", StringComparison.OrdinalIgnoreCase) => invoices.Where(invoice => string.Equals(invoice.SupplierNumber, ParseValue(value), StringComparison.OrdinalIgnoreCase)).ToArray(),
                var value when value.StartsWith("lastActionDate ge ", StringComparison.OrdinalIgnoreCase) => invoices.Where(invoice => invoice.LastActionDate >= DateTimeOffset.Parse(ParseValue(value))).ToArray(),
                var value when value.StartsWith("lastActionDate le ", StringComparison.OrdinalIgnoreCase) => invoices.Where(invoice => invoice.LastActionDate <= DateTimeOffset.Parse(ParseValue(value))).ToArray(),
                var value when value.StartsWith("approvedDate ge ", StringComparison.OrdinalIgnoreCase) => invoices.Where(invoice => invoice.ApprovedDate is not null && invoice.ApprovedDate >= DateTimeOffset.Parse(ParseValue(value))).ToArray(),
                var value when value.StartsWith("approvedDate le ", StringComparison.OrdinalIgnoreCase) => invoices.Where(invoice => invoice.ApprovedDate is not null && invoice.ApprovedDate <= DateTimeOffset.Parse(ParseValue(value))).ToArray(),
                _ => throw new InvalidOperationException("UNSUPPORTED_FILTER")
            };
        }

        return invoices;
    }

    private static string ParseValue(string clause)
    {
        var index = clause.IndexOf(" eq ", StringComparison.OrdinalIgnoreCase);
        if (index >= 0)
        {
            return clause[(index + 4)..].Trim().Trim('\'');
        }

        index = clause.IndexOf(" ge ", StringComparison.OrdinalIgnoreCase);
        if (index >= 0)
        {
            return clause[(index + 4)..].Trim().Trim('\'');
        }

        index = clause.IndexOf(" le ", StringComparison.OrdinalIgnoreCase);
        if (index >= 0)
        {
            return clause[(index + 4)..].Trim().Trim('\'');
        }

        return clause;
    }

    private int? TryGetInt(string key)
    {
        return Request.Query.TryGetValue(key, out var value) && int.TryParse(value.ToString(), out var parsed) ? parsed : null;
    }
}
