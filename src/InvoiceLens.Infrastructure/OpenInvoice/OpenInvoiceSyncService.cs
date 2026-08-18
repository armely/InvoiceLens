using System.Text;
using System.Text.Json;
using InvoiceLens.Application.Notifications;
using InvoiceLens.Infrastructure.Notifications;
using System.Xml.Linq;
using InvoiceLens.Infrastructure.Persistence;
using System.Security.Cryptography;
using Microsoft.Extensions.Logging;

namespace InvoiceLens.Infrastructure.OpenInvoice;

public sealed class OpenInvoiceSyncService(
    IOpenInvoiceClient client,
    OpenInvoiceSyncRepository repository,
    SqlInvoiceService invoices,
    OpenInvoiceOptions options,
    INotificationService notificationService,
    NotificationMessageFactory notificationMessageFactory,
    ILogger<OpenInvoiceSyncService> logger)
{
    private readonly OpenInvoiceOptions _options = options;
    private readonly string _storageRoot = string.IsNullOrWhiteSpace(options.StoragePath)
        ? Path.Combine(AppContext.BaseDirectory, "OpenInvoiceStorage")
        : Path.GetFullPath(options.StoragePath);

    public Task<int> SyncInvoicesAsync(CancellationToken cancellationToken)
    {
        return SyncInvoicesInternalAsync("invoice-list", true, cancellationToken);
    }

    public Task<int> SyncInvoiceDetailsAsync(CancellationToken cancellationToken)
    {
        return SyncInvoicesInternalAsync("invoice-detail", false, cancellationToken);
    }

    public Task<int> SyncAttachmentsAsync(CancellationToken cancellationToken)
    {
        return SyncInvoicesInternalAsync("invoice-attachments", false, cancellationToken);
    }

    public async Task<int> PostPendingEventsAsync(CancellationToken cancellationToken)
    {
        var pendingEvents = await repository.GetPendingEventsAsync(cancellationToken);
        var completed = 0;

        foreach (var pendingEvent in pendingEvents)
        {
            try
            {
                using var response = await client.PostEventAsync(pendingEvent.EventType, pendingEvent.PayloadJson, cancellationToken);
                var body = await response.Content.ReadAsByteArrayAsync(cancellationToken);
                await repository.SaveRawDocumentAsync(
                    pendingEvent.OpenInvoiceDocumentId ?? pendingEvent.Id.ToString(),
                    pendingEvent.EventType,
                    $"/docp/events/supply-chain/v1/{pendingEvent.EventType}",
                    response.Content.Headers.ContentType?.MediaType ?? "application/json",
                    response.Content.Headers.ContentEncoding.FirstOrDefault(),
                    body,
                    cancellationToken);

                await repository.MarkEventAttemptAsync(pendingEvent.Id, response.IsSuccessStatusCode ? null : response.ReasonPhrase, response.IsSuccessStatusCode, cancellationToken);
                if (response.IsSuccessStatusCode)
                {
                    completed++;
                }
            }
            catch (Exception exception)
            {
                await repository.MarkEventAttemptAsync(pendingEvent.Id, exception.Message, false, cancellationToken);
            }
        }

        return completed;
    }

    public Task<int> RetryFailedEventsAsync(CancellationToken cancellationToken)
    {
        return PostPendingEventsAsync(cancellationToken);
    }

    private async Task<int> SyncInvoicesInternalAsync(string documentType, bool requestList, CancellationToken cancellationToken)
    {
        await using var syncLock = await repository.TryAcquireSyncLockAsync(_options.Environment, cancellationToken);
        if (syncLock is null)
        {
            logger.LogInformation("Skipping {DocumentType} because another OpenInvoice reconciliation owns the database lock.", documentType);
            return 0;
        }

        var runId = await repository.BeginRunAsync(_options.Environment, documentType, cancellationToken);
        var requested = 0;
        var imported = 0;
        var failed = 0;

        try
        {
            var top = Math.Max(1, _options.DefaultPageSize);
            var skip = 0;
            var windowEndUtc = DateTimeOffset.UtcNow;
            var windowStartUtc = windowEndUtc.AddDays(-Math.Max(1, _options.SyncLookbackDays));
            var filter = $"lastActionDate ge '{windowStartUtc:O}' and lastActionDate le '{windowEndUtc:O}'";

            logger.LogInformation(
                "Starting OpenInvoice reconciliation for {DocumentType} from {WindowStartUtc} through {WindowEndUtc} using storage {StorageRoot}.",
                documentType,
                windowStartUtc,
                windowEndUtc,
                _storageRoot);

            while (true)
            {
                var query = $"?$count=true&$top={top}&$skip={skip}&$select={(requestList ? "invoice" : "*")}&$filter={Uri.EscapeDataString(filter)}";
                using var listResponse = await client.GetInvoiceListAsync(query, cancellationToken);
                var listBytes = await listResponse.Content.ReadAsByteArrayAsync(cancellationToken);
                await repository.SaveRawDocumentAsync($"invoice-list-{skip}", "invoice-list", $"/docp/supply-chain/v1/invoices{query}", listResponse.Content.Headers.ContentType?.MediaType ?? "application/json", listResponse.Content.Headers.ContentEncoding.FirstOrDefault(), listBytes, cancellationToken);
                requested++;

                if (!listResponse.IsSuccessStatusCode)
                {
                    failed++;
                    logger.LogError(
                        "OpenInvoice list request failed for window {WindowStartUtc} through {WindowEndUtc} with HTTP {StatusCode} ({ReasonPhrase}).",
                        windowStartUtc,
                        windowEndUtc,
                        (int)listResponse.StatusCode,
                        listResponse.ReasonPhrase);
                    await repository.CompleteRunAsync(runId, "Failed", requested, imported, failed, listResponse.ReasonPhrase, cancellationToken);
                    return imported;
                }

                var listJson = Encoding.UTF8.GetString(listBytes);
                var invoiceIds = ExtractDocumentIds(listJson);
                if (invoiceIds.Count == 0)
                {
                    break;
                }

                foreach (var invoiceId in invoiceIds)
                {
                    try
                    {
                        using var invoiceResponse = await client.GetInvoiceAsync(invoiceId, cancellationToken);
                        var invoiceBytes = await invoiceResponse.Content.ReadAsByteArrayAsync(cancellationToken);
                        var invoiceChanged = await repository.SaveRawDocumentIfChangedAsync(invoiceId, "invoice", $"/docp/supply-chain/v1/invoices/{invoiceId}", invoiceResponse.Content.Headers.ContentType?.MediaType ?? "application/xml", invoiceResponse.Content.Headers.ContentEncoding.FirstOrDefault(), invoiceBytes, cancellationToken);
                        requested++;

                        if (!invoiceResponse.IsSuccessStatusCode)
                        {
                            failed++;
                            logger.LogWarning(
                                "OpenInvoice detail request failed for DocumentId={DocumentId} with HTTP {StatusCode} ({ReasonPhrase}).",
                                invoiceId,
                                (int)invoiceResponse.StatusCode,
                                invoiceResponse.ReasonPhrase);
                            continue;
                        }

                        var invoiceDocument = XDocument.Parse(Encoding.UTF8.GetString(invoiceBytes));
                        var snapshot = OpenInvoiceInvoiceMapper.Map(invoiceDocument);
                        if (invoiceChanged || !await invoices.HasOpenInvoiceInvoiceAsync(invoiceId, cancellationToken))
                        {
                            _ = await invoices.UpsertOpenInvoiceInvoiceAsync(snapshot, cancellationToken);
                            imported++;
                        }

                        using var attachmentsResponse = await client.GetInvoiceAttachmentsAsync(invoiceId, cancellationToken);
                        var attachmentsBytes = await attachmentsResponse.Content.ReadAsByteArrayAsync(cancellationToken);
                        var attachmentListChanged = await repository.SaveRawDocumentIfChangedAsync(invoiceId, "attachments", $"/docp/supply-chain/v1/invoices/{invoiceId}/attachments", attachmentsResponse.Content.Headers.ContentType?.MediaType ?? "application/json", attachmentsResponse.Content.Headers.ContentEncoding.FirstOrDefault(), attachmentsBytes, cancellationToken);
                        requested++;

                        if (attachmentsResponse.IsSuccessStatusCode)
                        {
                            var attachments = OpenInvoiceAttachmentMapper.Map(Encoding.UTF8.GetString(attachmentsBytes));
                            var discoveredAttachments = snapshot.Attachments
                                .Concat(attachments.Attachments)
                                .Where(attachment => !string.IsNullOrWhiteSpace(attachment.AttachmentId))
                                .GroupBy(attachment => attachment.AttachmentId, StringComparer.OrdinalIgnoreCase)
                                .Select(group => group.OrderByDescending(item => item.FileName.Contains('.')).First())
                                .ToArray();
                            foreach (var attachment in discoveredAttachments)
                            {
                                using var attachmentResponse = await client.GetInvoiceAttachmentAsync(invoiceId, attachment.AttachmentId, cancellationToken);
                                var attachmentBytes = await attachmentResponse.Content.ReadAsByteArrayAsync(cancellationToken);
                                var attachmentChanged = await repository.SaveRawDocumentIfChangedAsync(attachment.AttachmentId, "attachment", $"/docp/supply-chain/v1/invoices/{invoiceId}/attachments/{attachment.AttachmentId}", attachmentResponse.Content.Headers.ContentType?.MediaType ?? attachment.ContentType, attachmentResponse.Content.Headers.ContentEncoding.FirstOrDefault(), attachmentBytes, cancellationToken);
                                requested++;
                                if (attachmentResponse.IsSuccessStatusCode)
                                {
                                    var metadata = AttachmentFileMetadataResolver.Resolve(
                                        attachment.FileName,
                                        attachmentResponse.Content.Headers.ContentType?.MediaType ?? attachment.ContentType,
                                        attachmentBytes);
                                    if (string.Equals(metadata.ContentType, "application/pdf", StringComparison.OrdinalIgnoreCase) &&
                                        !IsUsablePdfAttachment(attachmentBytes))
                                    {
                                        failed++;
                                        await invoices.RemoveOpenInvoiceAttachmentAsync(attachment.AttachmentId, cancellationToken);
                                        logger.LogWarning(
                                            "Rejected unusable PDF attachment for DocumentId={DocumentId}, AttachmentId={AttachmentId}, FileName={FileName}. The designed invoice fallback will be used.",
                                            invoiceId,
                                            attachment.AttachmentId,
                                            metadata.FileName);
                                        continue;
                                    }
                                    var normalizedAttachment = attachment with
                                    {
                                        FileName = metadata.FileName,
                                        ContentType = metadata.ContentType,
                                    };
                                    var attachmentStoragePath = ResolveBinaryPath("attachments", $"{attachment.AttachmentId}-{metadata.FileName}");
                                    var attachmentHash = Convert.ToBase64String(SHA256.HashData(attachmentBytes));
                                    var attachmentCurrent = File.Exists(attachmentStoragePath) &&
                                        await invoices.HasCurrentOpenInvoiceAttachmentAsync(attachment.AttachmentId, attachmentHash, attachmentStoragePath, cancellationToken);
                                    if (attachmentChanged || attachmentListChanged || !attachmentCurrent)
                                    {
                                        attachmentStoragePath = await WriteBinaryAsync("attachments", $"{attachment.AttachmentId}-{metadata.FileName}", attachmentBytes, cancellationToken);
                                        await invoices.UpsertOpenInvoiceAttachmentAsync(snapshot.InvoiceNumber, normalizedAttachment, attachmentStoragePath, attachmentBytes.LongLength, attachmentHash, cancellationToken);
                                    }
                                }
                                else
                                {
                                    failed++;
                                    await invoices.RemoveOpenInvoiceAttachmentAsync(attachment.AttachmentId, cancellationToken);
                                    logger.LogWarning(
                                        "OpenInvoice attachment request failed for DocumentId={DocumentId}, AttachmentId={AttachmentId} with HTTP {StatusCode} ({ReasonPhrase}).",
                                        invoiceId,
                                        attachment.AttachmentId,
                                        (int)attachmentResponse.StatusCode,
                                        attachmentResponse.ReasonPhrase);
                                }
                            }
                        }
                        else
                        {
                            failed++;
                            logger.LogWarning(
                                "OpenInvoice attachment-list request failed for DocumentId={DocumentId} with HTTP {StatusCode} ({ReasonPhrase}).",
                                invoiceId,
                                (int)attachmentsResponse.StatusCode,
                                attachmentsResponse.ReasonPhrase);
                        }

                        using var snapshotResponse = await client.GetInvoiceSnapshotAsync(invoiceId, cancellationToken);
                        var snapshotBytes = await snapshotResponse.Content.ReadAsByteArrayAsync(cancellationToken);
                        var snapshotChanged = await repository.SaveRawDocumentIfChangedAsync(invoiceId, "snapshot", $"/docp/supply-chain/v1/invoices/{invoiceId}/snapshot", snapshotResponse.Content.Headers.ContentType?.MediaType ?? "application/pdf", snapshotResponse.Content.Headers.ContentEncoding.FirstOrDefault(), snapshotBytes, cancellationToken);
                        requested++;
                        if (snapshotResponse.IsSuccessStatusCode)
                        {
                            var snapshotStoragePath = ResolveBinaryPath("snapshots", $"{invoiceId}.pdf");
                            var snapshotHash = Convert.ToBase64String(SHA256.HashData(snapshotBytes));
                            var snapshotCurrent = File.Exists(snapshotStoragePath) &&
                                await invoices.HasCurrentOpenInvoiceSnapshotAsync(snapshot.InvoiceNumber, snapshotHash, snapshotStoragePath, cancellationToken);
                            if (snapshotChanged || !snapshotCurrent)
                            {
                                snapshotStoragePath = await WriteBinaryAsync("snapshots", $"{invoiceId}.pdf", snapshotBytes, cancellationToken);
                                await invoices.UpsertOpenInvoiceSnapshotAsync(snapshot.InvoiceNumber, snapshotStoragePath, snapshotResponse.Content.Headers.ContentType?.MediaType ?? "application/pdf", snapshotBytes.LongLength, snapshotHash, cancellationToken);
                            }
                        }
                        else
                        {
                            failed++;
                            logger.LogWarning(
                                "OpenInvoice snapshot request failed for DocumentId={DocumentId} with HTTP {StatusCode} ({ReasonPhrase}).",
                                invoiceId,
                                (int)snapshotResponse.StatusCode,
                                snapshotResponse.ReasonPhrase);
                        }
                    }
                    catch (Exception exception)
                    {
                        failed++;
                        logger.LogError(exception, "OpenInvoice reconciliation failed for DocumentId={DocumentId}.", invoiceId);
                    }
                }

                if (invoiceIds.Count < top)
                {
                    break;
                }

                skip += top;
            }

            await repository.SaveCursorAsync(_options.Environment, documentType, DateTimeOffset.UtcNow, null, cancellationToken);
            await repository.ApplyRetentionAsync(_options.RawDocumentRetentionDays, _options.OperationalHistoryRetentionDays, cancellationToken);
            await repository.CompleteRunAsync(runId, failed > 0 ? "CompletedWithErrors" : "Completed", requested, imported, failed, null, cancellationToken);

            if (failed > 0)
            {
                try
                {
                    var message = notificationMessageFactory.CreateSystemAlert(
                        "OpenInvoice sync completed with errors",
                        $"DocumentType={documentType}, Requested={requested}, Imported={imported}, Failed={failed}",
                        NotificationSeverity.Warning);
                    await notificationService.SendAsync(message, cancellationToken);
                }
                catch (InvalidOperationException notificationException) when (notificationException.Message.Contains("notifications are disabled", StringComparison.OrdinalIgnoreCase))
                {
                    logger.LogDebug("Sync alert was not sent because notifications are disabled.");
                }
                catch (Exception notificationException)
                {
                    logger.LogWarning(notificationException, "Sync error alert notification failed for {DocumentType}.", documentType);
                }
            }

            return imported;
        }
        catch (Exception exception)
        {
            await repository.CompleteRunAsync(runId, "Failed", requested, imported, failed + 1, exception.Message, cancellationToken);

            try
            {
                var message = notificationMessageFactory.CreateSystemAlert(
                    "OpenInvoice sync failed",
                    $"DocumentType={documentType}, Error={exception.Message}",
                    NotificationSeverity.Critical);
                await notificationService.SendAsync(message, cancellationToken);
            }
            catch (Exception notificationException)
            {
                logger.LogWarning(notificationException, "Sync failure alert notification failed for {DocumentType}.", documentType);
            }

            throw;
        }
    }

    private static IReadOnlyList<string> ExtractDocumentIds(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        var ids = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        if (root.TryGetProperty("links", out var links) && links.ValueKind == JsonValueKind.Array)
        {
            foreach (var link in links.EnumerateArray())
            {
                if (link.TryGetProperty("href", out var href) && href.ValueKind == JsonValueKind.String &&
                    TryExtractInvoiceIdFromHref(href.GetString(), out var fromHref))
                {
                    ids.Add(fromHref);
                }
            }
        }

        CollectIdsFromArrayProperty(root, "invoices", ids);
        CollectIdsFromArrayProperty(root, "items", ids);
        CollectIdsFromArrayProperty(root, "data", ids);

        return ids.ToArray();
    }

    private static void CollectIdsFromArrayProperty(JsonElement root, string propertyName, ISet<string> ids)
    {
        if (!root.TryGetProperty(propertyName, out var array) || array.ValueKind != JsonValueKind.Array)
        {
            return;
        }

        foreach (var item in array.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            if (TryGetStringProperty(item, "documentId", out var documentId) && !string.IsNullOrWhiteSpace(documentId))
            {
                ids.Add(documentId.Trim());
            }

            if (TryGetStringProperty(item, "invoiceId", out var invoiceId) && !string.IsNullOrWhiteSpace(invoiceId))
            {
                ids.Add(invoiceId.Trim());
            }

            if (TryGetStringProperty(item, "id", out var id) && !string.IsNullOrWhiteSpace(id))
            {
                ids.Add(id.Trim());
            }

            if (item.TryGetProperty("links", out var links) && links.ValueKind == JsonValueKind.Array)
            {
                foreach (var link in links.EnumerateArray())
                {
                    if (link.TryGetProperty("href", out var href) && href.ValueKind == JsonValueKind.String &&
                        TryExtractInvoiceIdFromHref(href.GetString(), out var fromHref))
                    {
                        ids.Add(fromHref);
                    }
                }
            }
        }
    }

    private static bool TryGetStringProperty(JsonElement element, string propertyName, out string value)
    {
        value = string.Empty;
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        value = property.GetString() ?? string.Empty;
        return true;
    }

    private static bool TryExtractInvoiceIdFromHref(string? href, out string invoiceId)
    {
        invoiceId = string.Empty;
        if (string.IsNullOrWhiteSpace(href))
        {
            return false;
        }

        var path = href;
        if (Uri.TryCreate(href, UriKind.Absolute, out var absoluteUri))
        {
            path = absoluteUri.AbsolutePath;
        }
        else
        {
            var queryIndex = path.IndexOf('?');
            if (queryIndex >= 0)
            {
                path = path[..queryIndex];
            }
        }

        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        for (var index = 0; index < segments.Length - 1; index++)
        {
            if (!segments[index].Equals("invoices", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var candidate = Uri.UnescapeDataString(segments[index + 1]);
            if (string.IsNullOrWhiteSpace(candidate) ||
                candidate.Equals("attachments", StringComparison.OrdinalIgnoreCase) ||
                candidate.Equals("snapshot", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            invoiceId = candidate;
            return true;
        }

        return false;
    }

    private async Task<string> WriteBinaryAsync(string subDirectory, string fileName, byte[] bytes, CancellationToken cancellationToken)
    {
        var path = ResolveBinaryPath(subDirectory, fileName);
        var directory = Path.GetDirectoryName(path)!;
        Directory.CreateDirectory(directory);
        await File.WriteAllBytesAsync(path, bytes, cancellationToken);
        return path;
    }

    private string ResolveBinaryPath(string subDirectory, string fileName)
    {
        var safeName = string.Concat(fileName.Where(character => !Path.GetInvalidFileNameChars().Contains(character)));
        return Path.Combine(_storageRoot, subDirectory, safeName);
    }

    private static bool IsUsablePdfAttachment(byte[] bytes)
    {
        if (bytes.Length < 1024 || !bytes.AsSpan(0, Math.Min(5, bytes.Length)).SequenceEqual("%PDF-"u8))
        {
            return false;
        }

        var tailLength = Math.Min(1024, bytes.Length);
        return Encoding.ASCII.GetString(bytes, bytes.Length - tailLength, tailLength).Contains("%%EOF", StringComparison.Ordinal);
    }
}
