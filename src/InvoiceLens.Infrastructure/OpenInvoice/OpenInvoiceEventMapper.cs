using System.Text.Json;

namespace InvoiceLens.Infrastructure.OpenInvoice;

public sealed record OpenInvoiceEventEnvelope(string EventType, string PayloadJson, DateTimeOffset OccurredAtUtc, string Status, int AttemptCount, string? LastError);

public static class OpenInvoiceEventMapper
{
    public static string CreateExportStatusPayload(string documentId, string invoiceNumber, string supplierNumber, string serviceType, string serviceStatus, string? comment)
    {
        return JsonSerializer.Serialize(new
        {
            context = new
            {
                documentId,
                invoiceNumber,
                supplierNumber
            },
            transform = new
            {
                serviceType,
                serviceStatus,
                comment
            }
        });
    }
}
