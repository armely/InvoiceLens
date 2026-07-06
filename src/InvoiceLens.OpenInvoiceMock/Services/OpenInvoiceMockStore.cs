using System.Text.Json;
using System.Xml.Linq;
using InvoiceLens.OpenInvoiceMock.Models;
using InvoiceLens.Infrastructure.OpenInvoice;

namespace InvoiceLens.OpenInvoiceMock;

public sealed class OpenInvoiceMockStore
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true
    };

    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly string _dataDirectory;
    private readonly string _storageDirectory;
    private List<OpenInvoiceInvoiceRecord> _invoices = [];
    private List<OpenInvoiceSupplierRecord> _suppliers = [];
    private List<OpenInvoiceEventRecord> _events = [];

    public OpenInvoiceMockStore(IWebHostEnvironment environment)
    {
        _dataDirectory = Path.Combine(environment.ContentRootPath, "Data");
        _storageDirectory = Path.Combine(environment.ContentRootPath, "Storage");
        Load();
    }

    public IReadOnlyList<OpenInvoiceInvoiceRecord> GetInvoices()
    {
        return _invoices;
    }

    public OpenInvoiceInvoiceRecord? GetInvoice(string documentId)
    {
        return _invoices.FirstOrDefault(invoice => string.Equals(invoice.DocumentId, documentId, StringComparison.OrdinalIgnoreCase));
    }

    public IReadOnlyList<OpenInvoiceAttachmentRecord> GetAttachments(string documentId)
    {
        return GetInvoice(documentId)?.Attachments ?? [];
    }

    public Stream OpenSnapshot(string documentId)
    {
        var invoice = GetInvoice(documentId) ?? throw new KeyNotFoundException("Invoice not found.");
        var path = Path.Combine(_storageDirectory, "snapshots", invoice.SnapshotFileName);
        if (!File.Exists(path))
        {
            throw new FileNotFoundException("Snapshot file not found.", path);
        }

        return File.OpenRead(path);
    }

    public Stream OpenAttachment(OpenInvoiceAttachmentRecord attachment)
    {
        var path = Path.Combine(_storageDirectory, "attachments", attachment.StorageFileName);
        if (!File.Exists(path))
        {
            throw new FileNotFoundException("Attachment file not found.", path);
        }

        return File.OpenRead(path);
    }

    public async Task<OpenInvoiceInvoiceRecord> UpdateInvoiceAsync(string documentId, Action<OpenInvoiceInvoiceRecord> update)
    {
        await _gate.WaitAsync();
        try
        {
            var index = _invoices.FindIndex(invoice => string.Equals(invoice.DocumentId, documentId, StringComparison.OrdinalIgnoreCase));
            if (index < 0)
            {
                throw new KeyNotFoundException("Invoice not found.");
            }

            var invoice = _invoices[index];
            update(invoice);
            invoice.LastActionDate = DateTimeOffset.UtcNow;
            _invoices[index] = invoice;
            await SaveInvoicesAsync();
            return invoice;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<OpenInvoiceEventRecord> AppendEventAsync(OpenInvoiceEventRecord record)
    {
        await _gate.WaitAsync();
        try
        {
            _events.Add(record);
            await SaveEventsAsync();
            return record;
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task<IReadOnlyList<OpenInvoiceEventRecord>> GetEventsAsync()
    {
        await _gate.WaitAsync();
        try
        {
            return _events.ToArray();
        }
        finally
        {
            _gate.Release();
        }
    }

    public XDocument BuildInvoiceDocument(OpenInvoiceInvoiceRecord invoice)
    {
        var lineItems = new XElement("lineItems",
            invoice.LineItems.Select(line => new XElement("lineItem",
                new XElement("lineNumber", line.LineNumber),
                new XElement("description", line.Description ?? string.Empty),
                new XElement("quantity", line.Quantity.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                new XElement("unitPrice", line.UnitPrice.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                new XElement("amount", line.Amount.ToString(System.Globalization.CultureInfo.InvariantCulture)))));

        var codingFields = new XElement("codingFields",
            invoice.CodingFields.Select(field => new XElement("field", new XAttribute("name", field.Key), field.Value)));

        var attachments = new XElement("attachments",
            invoice.Attachments.Select(attachment => new XElement("attachment",
                new XElement("attachmentId", attachment.AttachmentId),
                new XElement("fileName", attachment.FileName),
                new XElement("contentType", attachment.ContentType),
                new XElement("sizeBytes", attachment.SizeBytes),
                new XElement("storageFileName", attachment.StorageFileName))));

        return new XDocument(
            new XElement("invoice",
                new XElement("documentId", invoice.DocumentId),
                new XElement("invoiceNumber", invoice.InvoiceNumber),
                new XElement("supplierNumber", invoice.SupplierNumber),
                new XElement("supplierName", invoice.SupplierName),
                new XElement("status", invoice.Status),
                new XElement("serviceType", invoice.ServiceType),
                new XElement("serviceStatus", invoice.ServiceStatus),
                new XElement("invoiceDate", invoice.InvoiceDate.ToString("O")),
                new XElement("receivedDate", invoice.ReceivedDate.ToString("O")),
                invoice.ApprovedDate is null ? new XElement("approvedDate") : new XElement("approvedDate", invoice.ApprovedDate.Value.ToString("O")),
                new XElement("currency", invoice.Currency),
                new XElement("subtotal", invoice.Subtotal.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                new XElement("tax", invoice.Tax.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                new XElement("total", invoice.Total.ToString(System.Globalization.CultureInfo.InvariantCulture)),
                new XElement("lastActionDate", invoice.LastActionDate.ToString("O")),
                lineItems,
                codingFields,
                attachments));
    }

    public string BuildListResponse(IEnumerable<OpenInvoiceInvoiceRecord> invoices, bool includeRepresentation)
    {
        if (!includeRepresentation)
        {
            var minimal = new
            {
                meta = new OpenInvoiceListMeta(true, invoices.Count(), 1, invoices.Count()),
                links = invoices.Select(invoice => new OpenInvoiceLink("invoice", $"/docp/supply-chain/v1/invoices/{invoice.DocumentId}")).ToArray()
            };

            return JsonSerializer.Serialize(minimal, JsonOptions);
        }

        var xml = new XDocument(new XElement("invoices",
            invoices.Select(invoice => new XElement("invoice",
                new XAttribute("documentId", invoice.DocumentId),
                new XElement("invoiceNumber", invoice.InvoiceNumber),
                new XElement("supplierNumber", invoice.SupplierNumber),
                new XElement("supplierName", invoice.SupplierName),
                new XElement("status", invoice.Status),
                new XElement("snapshot", $"/docp/supply-chain/v1/invoices/{invoice.DocumentId}/snapshot"),
                new XElement("attachments",
                    invoice.Attachments.Select(attachment => new XElement("attachment",
                        new XElement("attachmentId", attachment.AttachmentId),
                        new XElement("href", $"/docp/supply-chain/v1/invoices/{invoice.DocumentId}/attachments/{attachment.AttachmentId}"))))))));

        return xml.ToString(SaveOptions.DisableFormatting);
    }

    private void Load()
    {
        Directory.CreateDirectory(_dataDirectory);
        Directory.CreateDirectory(Path.Combine(_storageDirectory, "snapshots"));
        Directory.CreateDirectory(Path.Combine(_storageDirectory, "attachments"));

        _invoices = ReadFile<List<OpenInvoiceInvoiceRecord>>("invoices.json") ?? [];
        _suppliers = ReadFile<List<OpenInvoiceSupplierRecord>>("suppliers.json") ?? [];
        _events = ReadFile<List<OpenInvoiceEventRecord>>("event-history.json") ?? [];
    }

    private T? ReadFile<T>(string name)
    {
        var path = Path.Combine(_dataDirectory, name);
        if (!File.Exists(path))
        {
            return default;
        }

        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<T>(json, JsonOptions);
    }

    private async Task SaveInvoicesAsync()
    {
        var path = Path.Combine(_dataDirectory, "invoices.json");
        await File.WriteAllTextAsync(path, JsonSerializer.Serialize(_invoices, JsonOptions));
    }

    private async Task SaveEventsAsync()
    {
        var path = Path.Combine(_dataDirectory, "event-history.json");
        await File.WriteAllTextAsync(path, JsonSerializer.Serialize(_events, JsonOptions));
    }
}
