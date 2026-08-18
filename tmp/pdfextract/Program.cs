using UglyToad.PdfPig;

using var document = PdfDocument.Open(args[0]);
foreach (var page in document.GetPages())
{
    var text = page.Text;
    if (text.Contains("attach", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("document content", StringComparison.OrdinalIgnoreCase) ||
        text.Contains("supporting", StringComparison.OrdinalIgnoreCase))
    {
        Console.WriteLine($"===== PAGE {page.Number} =====");
        Console.WriteLine(text);
    }
}
