namespace InvoiceLens.Infrastructure.OpenInvoice;

public class InvoiceListResponseParser
{
    public IReadOnlyList<string> Parse(string payload)
    {
        return string.IsNullOrWhiteSpace(payload) ? [] : payload.Split(',').Select(x => x.Trim()).Where(x => x.Length > 0).ToList();
    }
}
