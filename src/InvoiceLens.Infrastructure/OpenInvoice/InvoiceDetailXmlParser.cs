namespace InvoiceLens.Infrastructure.OpenInvoice;

public class InvoiceDetailXmlParser
{
    public Dictionary<string, string> Parse(string xml)
    {
        return new Dictionary<string, string>
        {
            ["raw"] = xml,
            ["parsedAtUtc"] = DateTimeOffset.UtcNow.ToString("O")
        };
    }
}
