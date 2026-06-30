namespace InvoiceLens.Infrastructure.OpenInvoice;

public class OpenInvoicePagingService
{
    public IEnumerable<int> GetPages(int totalItems, int pageSize)
    {
        if (pageSize <= 0)
        {
            yield break;
        }

        var pages = (int)Math.Ceiling(totalItems / (double)pageSize);
        for (var i = 1; i <= pages; i++)
        {
            yield return i;
        }
    }
}
