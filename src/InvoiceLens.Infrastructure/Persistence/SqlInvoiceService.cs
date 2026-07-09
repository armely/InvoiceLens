using InvoiceLens.Application.ComplianceQueue;
using InvoiceLens.Application.Invoices;
using InvoiceLens.Application.Sync;
using InvoiceLens.Infrastructure.OpenInvoice;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace InvoiceLens.Infrastructure.Persistence;

public class SqlInvoiceService(ILogger<SqlInvoiceService> logger) : IInvoiceQueries, IQueueService, ISyncStatusService
{
    public async Task<IReadOnlyList<InvoiceSummaryDto>> SearchAsync(string? query, CancellationToken cancellationToken)
    {
        try
        {
            var trimmedQuery = query?.Trim();
            await using var connection = SqlConnectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            if (string.IsNullOrEmpty(trimmedQuery))
            {
                command.CommandText = """
                    SELECT InvoiceId, InvoiceNumber, VendorCode, CompanyCode, ISNULL(AfeCode, '') AS AfeCode, TotalAmount, CurrencyCode, Status, CreatedAtUtc, UpdatedAtUtc
                    FROM dbo.Invoice
                    ORDER BY UpdatedAtUtc DESC, InvoiceNumber ASC;
                    """;
            }
            else
            {
                command.CommandText = """
                    SELECT InvoiceId, InvoiceNumber, VendorCode, CompanyCode, ISNULL(AfeCode, '') AS AfeCode, TotalAmount, CurrencyCode, Status, CreatedAtUtc, UpdatedAtUtc
                    FROM dbo.Invoice
                    WHERE InvoiceNumber LIKE @Pattern
                       OR VendorCode LIKE @Pattern
                       OR CompanyCode LIKE @Pattern
                       OR ISNULL(AfeCode, '') LIKE @Pattern
                    ORDER BY UpdatedAtUtc DESC, InvoiceNumber ASC;
                    """;

                command.Parameters.Add("@Pattern", System.Data.SqlDbType.NVarChar, 4000).Value = $"%{trimmedQuery}%";
            }

            var results = new List<InvoiceSummaryDto>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                results.Add(new InvoiceSummaryDto(
                    reader.GetGuidValue("InvoiceId"),
                    reader.GetStringValue("InvoiceNumber"),
                    reader.GetStringValue("VendorCode"),
                    reader.GetStringValue("CompanyCode"),
                    reader.GetStringValue("AfeCode"),
                    reader.GetDecimalValue("TotalAmount"),
                    reader.GetStringValue("CurrencyCode"),
                    reader.GetStringValue("Status"),
                    reader.GetDateTimeOffsetValue("CreatedAtUtc"),
                    reader.GetDateTimeOffsetValue("UpdatedAtUtc")));
            }

            return results;
        }
        catch (SqlException exception)
        {
            logger.LogError(exception, "Failed while searching invoices.");
            throw SqlFailureHandling.CreateException(exception, "searching invoices");
        }
    }

    public async Task<InvoiceDetailDto?> GetDetailAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = SqlConnectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT
                    InvoiceId,
                    InvoiceNumber,
                    VendorCode,
                    CompanyCode,
                    AfeCode,
                    TotalAmount,
                    CurrencyCode,
                    Status,
                    InvoiceDateUtc,
                    DueDateUtc,
                    BillToName,
                    BillToAddressLine1,
                    BillToAddressLine2,
                    BillToCity,
                    BillToRegion,
                    BillToPostalCode,
                    BillToEmail,
                    BillToPhone,
                    VendorAddressLine1,
                    VendorAddressLine2,
                    VendorCity,
                    VendorRegion,
                    VendorPostalCode,
                    VendorEmail,
                    PaymentTerms,
                    Notes,
                    SubtotalAmount,
                    TaxAmount,
                    DiscountAmount,
                    CreatedAtUtc,
                    UpdatedAtUtc
                FROM dbo.Invoice
                WHERE InvoiceId = @InvoiceId;
                """;
            command.Parameters.AddWithValue("@InvoiceId", invoiceId);

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return null;
            }

            var invoiceIdValue = reader.GetGuidValue("InvoiceId");
            var invoiceNumber = reader.GetStringValue("InvoiceNumber");
            var vendor = reader.GetStringValue("VendorCode");
            var company = reader.GetStringValue("CompanyCode");
            var afe = reader.GetNullableStringValue("AfeCode") ?? string.Empty;
            var amount = reader.GetDecimalValue("TotalAmount");
            var currency = reader.GetStringValue("CurrencyCode");
            var status = reader.GetStringValue("Status");
            var createdAtUtc = reader.GetDateTimeOffsetValue("CreatedAtUtc");
            var updatedAtUtc = reader.GetDateTimeOffsetValue("UpdatedAtUtc");
            var invoiceDateUtc = reader.GetNullableDateTimeOffsetValue("InvoiceDateUtc");
            var dueDateUtc = reader.GetNullableDateTimeOffsetValue("DueDateUtc");
            var billTo = new InvoiceContactDto(
                reader.GetNullableStringValue("BillToName") ?? company,
                reader.GetNullableStringValue("BillToAddressLine1") ?? string.Empty,
                reader.GetNullableStringValue("BillToAddressLine2"),
                reader.GetNullableStringValue("BillToCity") ?? string.Empty,
                reader.GetNullableStringValue("BillToRegion") ?? string.Empty,
                reader.GetNullableStringValue("BillToPostalCode") ?? string.Empty,
                reader.GetNullableStringValue("BillToEmail") ?? string.Empty,
                reader.GetNullableStringValue("BillToPhone") ?? string.Empty);
            var vendorContact = new InvoiceContactDto(
                vendor,
                reader.GetNullableStringValue("VendorAddressLine1") ?? string.Empty,
                reader.GetNullableStringValue("VendorAddressLine2"),
                reader.GetNullableStringValue("VendorCity") ?? string.Empty,
                reader.GetNullableStringValue("VendorRegion") ?? string.Empty,
                reader.GetNullableStringValue("VendorPostalCode") ?? string.Empty,
                reader.GetNullableStringValue("VendorEmail") ?? string.Empty,
                string.Empty);
            var paymentTerms = reader.GetNullableStringValue("PaymentTerms");
            var notes = reader.GetNullableStringValue("Notes");
            var subtotal = reader.GetNullableDecimalValue("SubtotalAmount") ?? amount;
            var tax = reader.GetNullableDecimalValue("TaxAmount") ?? 0m;
            var discount = reader.GetNullableDecimalValue("DiscountAmount") ?? 0m;

            await reader.DisposeAsync();

            var lineItems = await LoadInvoiceLineItemsAsync(connection, invoiceIdValue, cancellationToken);

            return new InvoiceDetailDto(
                invoiceIdValue,
                invoiceNumber,
                vendor,
                company,
                afe,
                amount,
                currency,
                status,
                createdAtUtc,
                updatedAtUtc,
                invoiceDateUtc,
                dueDateUtc,
                billTo,
                vendorContact,
                paymentTerms,
                notes,
                new InvoiceTotalsDto(subtotal, tax, discount, amount),
                lineItems);
        }
        catch (SqlException exception)
        {
            logger.LogError(exception, "Failed while loading invoice detail for {InvoiceId}.", invoiceId);
            throw SqlFailureHandling.CreateException(exception, "loading invoice details");
        }
    }

    private static async Task<IReadOnlyList<InvoiceLineItemDto>> LoadInvoiceLineItemsAsync(SqlConnection connection, Guid invoiceId, CancellationToken cancellationToken)
    {
        var lineItems = new List<InvoiceLineItemDto>();

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT LineNumber, Description, Quantity, UnitPrice, Amount
            FROM dbo.InvoiceLine
            WHERE InvoiceId = @InvoiceId
            ORDER BY LineNumber ASC;
            """;
        command.Parameters.AddWithValue("@InvoiceId", invoiceId);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            lineItems.Add(new InvoiceLineItemDto(
                reader.GetInt32Value("LineNumber"),
                reader.GetNullableStringValue("Description"),
                reader.GetDecimalValue("Quantity"),
                reader.GetDecimalValue("UnitPrice"),
                reader.GetDecimalValue("Amount")));
        }

        return lineItems;
    }

    public async Task<InvoiceReviewDto?> GetReviewAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        try
        {
            var invoice = await GetDetailAsync(invoiceId, cancellationToken);
            if (invoice is null)
            {
                return null;
            }

            await using var connection = SqlConnectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);

            var validationHighlights = new List<string>();
            await using (var validationCommand = connection.CreateCommand())
            {
                validationCommand.CommandText = """
                    SELECT TOP (5) RuleName, Status, Message
                    FROM dbo.ValidationResult
                    WHERE InvoiceId = @InvoiceId
                    ORDER BY ExecutedAtUtc DESC;
                    """;
                validationCommand.Parameters.AddWithValue("@InvoiceId", invoiceId);

                await using var validationReader = await validationCommand.ExecuteReaderAsync(cancellationToken);
                while (await validationReader.ReadAsync(cancellationToken))
                {
                    validationHighlights.Add($"{validationReader.GetStringValue("RuleName")}: {validationReader.GetStringValue("Status")} ({validationReader.GetStringValue("Message")})");
                }
            }

            var attachments = new List<string>();
            await using (var attachmentCommand = connection.CreateCommand())
            {
                attachmentCommand.CommandText = """
                    SELECT FileName
                    FROM dbo.InvoiceAttachmentReference
                    WHERE InvoiceId = @InvoiceId
                    ORDER BY CreatedAtUtc DESC;
                    """;
                attachmentCommand.Parameters.AddWithValue("@InvoiceId", invoiceId);

                await using var attachmentReader = await attachmentCommand.ExecuteReaderAsync(cancellationToken);
                while (await attachmentReader.ReadAsync(cancellationToken))
                {
                    attachments.Add(attachmentReader.GetStringValue("FileName"));
                }
            }

            return new InvoiceReviewDto(
                invoice,
                validationHighlights,
                attachments);
        }
        catch (SqlException exception)
        {
            logger.LogError(exception, "Failed while loading invoice review for {InvoiceId}.", invoiceId);
            throw SqlFailureHandling.CreateException(exception, "loading invoice review");
        }
    }

    public Task<bool> ApproveAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        return UpdateStatusAndEnqueueAsync(
            invoiceId,
            "Approved",
            "invoice.approve",
            new
            {
                serviceType = "approved",
                serviceStatus = "success",
                comment = "Approved from InvoiceLens."
            },
            cancellationToken);
    }

    public Task<bool> SendBackAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        return UpdateStatusAndEnqueueAsync(
            invoiceId,
            "SentBack",
            "invoice.dispute",
            new
            {
                serviceType = "submitted",
                serviceStatus = "failed",
                comment = "Sent back from InvoiceLens."
            },
            cancellationToken);
    }

    public async Task<Guid> UpsertOpenInvoiceInvoiceAsync(OpenInvoiceInvoiceSnapshot snapshot, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var invoiceId = await GetInvoiceIdByNumberAsync(connection, snapshot.InvoiceNumber, cancellationToken) ?? Guid.NewGuid();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            IF EXISTS (SELECT 1 FROM dbo.Invoice WHERE InvoiceId = @InvoiceId)
            BEGIN
                UPDATE dbo.Invoice
                SET InvoiceNumber = @InvoiceNumber,
                    OpenInvoiceDocumentId = @OpenInvoiceDocumentId,
                    VendorCode = @VendorCode,
                    CompanyCode = @CompanyCode,
                    AfeCode = @AfeCode,
                    TotalAmount = @TotalAmount,
                    CurrencyCode = @CurrencyCode,
                    Status = @Status,
                    InvoiceDateUtc = @InvoiceDateUtc,
                    DueDateUtc = @DueDateUtc,
                    BillToName = @BillToName,
                    BillToAddressLine1 = @BillToAddressLine1,
                    BillToAddressLine2 = @BillToAddressLine2,
                    BillToCity = @BillToCity,
                    BillToRegion = @BillToRegion,
                    BillToPostalCode = @BillToPostalCode,
                    BillToEmail = @BillToEmail,
                    BillToPhone = @BillToPhone,
                    VendorAddressLine1 = @VendorAddressLine1,
                    VendorAddressLine2 = @VendorAddressLine2,
                    VendorCity = @VendorCity,
                    VendorRegion = @VendorRegion,
                    VendorPostalCode = @VendorPostalCode,
                    VendorEmail = @VendorEmail,
                    PaymentTerms = @PaymentTerms,
                    Notes = @Notes,
                    SubtotalAmount = @SubtotalAmount,
                    TaxAmount = @TaxAmount,
                    DiscountAmount = @DiscountAmount,
                    UpdatedAtUtc = SYSUTCDATETIME()
                WHERE InvoiceId = @InvoiceId;
            END
            ELSE
            BEGIN
                INSERT INTO dbo.Invoice
                    (
                        InvoiceId,
                        InvoiceNumber,
                        OpenInvoiceDocumentId,
                        VendorCode,
                        CompanyCode,
                        AfeCode,
                        TotalAmount,
                        CurrencyCode,
                        Status,
                        InvoiceDateUtc,
                        DueDateUtc,
                        BillToName,
                        BillToAddressLine1,
                        BillToAddressLine2,
                        BillToCity,
                        BillToRegion,
                        BillToPostalCode,
                        BillToEmail,
                        BillToPhone,
                        VendorAddressLine1,
                        VendorAddressLine2,
                        VendorCity,
                        VendorRegion,
                        VendorPostalCode,
                        VendorEmail,
                        PaymentTerms,
                        Notes,
                        SubtotalAmount,
                        TaxAmount,
                        DiscountAmount,
                        UpdatedAtUtc,
                        CreatedAtUtc
                    )
                VALUES
                    (
                        @InvoiceId,
                        @InvoiceNumber,
                        @OpenInvoiceDocumentId,
                        @VendorCode,
                        @CompanyCode,
                        @AfeCode,
                        @TotalAmount,
                        @CurrencyCode,
                        @Status,
                        @InvoiceDateUtc,
                        @DueDateUtc,
                        @BillToName,
                        @BillToAddressLine1,
                        @BillToAddressLine2,
                        @BillToCity,
                        @BillToRegion,
                        @BillToPostalCode,
                        @BillToEmail,
                        @BillToPhone,
                        @VendorAddressLine1,
                        @VendorAddressLine2,
                        @VendorCity,
                        @VendorRegion,
                        @VendorPostalCode,
                        @VendorEmail,
                        @PaymentTerms,
                        @Notes,
                        @SubtotalAmount,
                        @TaxAmount,
                        @DiscountAmount,
                        SYSUTCDATETIME(),
                        SYSUTCDATETIME()
                    );
            END
            """;
        command.Parameters.AddWithValue("@InvoiceId", invoiceId);
        command.Parameters.AddWithValue("@InvoiceNumber", snapshot.InvoiceNumber);
        command.Parameters.AddWithValue("@OpenInvoiceDocumentId", snapshot.DocumentId);
        command.Parameters.AddWithValue("@VendorCode", snapshot.SupplierNumber);
        command.Parameters.AddWithValue("@CompanyCode", snapshot.ServiceType);
        command.Parameters.AddWithValue("@AfeCode", snapshot.CodingFields.TryGetValue("afe", out var afe) ? afe : (object?)DBNull.Value);
        command.Parameters.AddWithValue("@TotalAmount", snapshot.Total);
        command.Parameters.AddWithValue("@CurrencyCode", snapshot.Currency);
        command.Parameters.AddWithValue("@Status", MapStatus(snapshot.Status));
        command.Parameters.AddWithValue("@InvoiceDateUtc", snapshot.InvoiceDate.UtcDateTime);
        command.Parameters.AddWithValue("@DueDateUtc", snapshot.InvoiceDate.AddDays(30).UtcDateTime);
        command.Parameters.AddWithValue("@BillToName", snapshot.ServiceType);
        command.Parameters.AddWithValue("@BillToAddressLine1", "OpenInvoice billing desk");
        command.Parameters.AddWithValue("@BillToAddressLine2", DBNull.Value);
        command.Parameters.AddWithValue("@BillToCity", "Unknown");
        command.Parameters.AddWithValue("@BillToRegion", "US");
        command.Parameters.AddWithValue("@BillToPostalCode", DBNull.Value);
        command.Parameters.AddWithValue("@BillToEmail", DBNull.Value);
        command.Parameters.AddWithValue("@BillToPhone", DBNull.Value);
        command.Parameters.AddWithValue("@VendorAddressLine1", snapshot.SupplierName);
        command.Parameters.AddWithValue("@VendorAddressLine2", DBNull.Value);
        command.Parameters.AddWithValue("@VendorCity", "Unknown");
        command.Parameters.AddWithValue("@VendorRegion", "US");
        command.Parameters.AddWithValue("@VendorPostalCode", DBNull.Value);
        command.Parameters.AddWithValue("@VendorEmail", DBNull.Value);
        command.Parameters.AddWithValue("@PaymentTerms", "Net 30");
        command.Parameters.AddWithValue("@Notes", snapshot.Status);
        command.Parameters.AddWithValue("@SubtotalAmount", snapshot.Subtotal);
        command.Parameters.AddWithValue("@TaxAmount", snapshot.Tax);
        command.Parameters.AddWithValue("@DiscountAmount", snapshot.Subtotal + snapshot.Tax - snapshot.Total);
        await command.ExecuteNonQueryAsync(cancellationToken);

        await ReplaceInvoiceLinesAsync(connection, invoiceId, snapshot.LineItems, cancellationToken);
        return invoiceId;
    }

    public async Task UpsertOpenInvoiceAttachmentAsync(string invoiceNumber, OpenInvoiceAttachmentSnapshot attachment, string storagePath, long sizeBytes, string bodyHash, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var invoiceId = await GetInvoiceIdByNumberAsync(connection, invoiceNumber, cancellationToken);
        if (invoiceId is null)
        {
            return;
        }

        await using var command = connection.CreateCommand();
        command.CommandText = """
            IF EXISTS (SELECT 1 FROM dbo.InvoiceAttachmentReference WHERE ExternalAttachmentId = @ExternalAttachmentId AND InvoiceId = @InvoiceId)
            BEGIN
                UPDATE dbo.InvoiceAttachmentReference
                SET FileName = @FileName,
                    ContentType = @ContentType
                WHERE ExternalAttachmentId = @ExternalAttachmentId AND InvoiceId = @InvoiceId;
            END
            ELSE
            BEGIN
                INSERT INTO dbo.InvoiceAttachmentReference
                    (AttachmentId, InvoiceId, ExternalAttachmentId, FileName, ContentType, CreatedAtUtc)
                VALUES
                    (@AttachmentId, @InvoiceId, @ExternalAttachmentId, @FileName, @ContentType, SYSUTCDATETIME());
            END
            """;
        command.Parameters.AddWithValue("@AttachmentId", Guid.NewGuid());
        command.Parameters.AddWithValue("@InvoiceId", invoiceId.Value);
        command.Parameters.AddWithValue("@ExternalAttachmentId", attachment.AttachmentId);
        command.Parameters.AddWithValue("@FileName", attachment.FileName);
        command.Parameters.AddWithValue("@ContentType", attachment.ContentType);
        await command.ExecuteNonQueryAsync(cancellationToken);

        await using var attachmentInsert = connection.CreateCommand();
        attachmentInsert.CommandText = """
            IF EXISTS (SELECT 1 FROM dbo.InvoiceAttachments WHERE OpenInvoiceAttachmentId = @OpenInvoiceAttachmentId)
            BEGIN
                UPDATE dbo.InvoiceAttachments
                SET InvoiceId = @InvoiceId,
                    FileName = @FileName,
                    ContentType = @ContentType,
                    SizeBytes = @SizeBytes,
                    StoragePath = @StoragePath,
                    BodyHash = @BodyHash
                WHERE OpenInvoiceAttachmentId = @OpenInvoiceAttachmentId;
            END
            ELSE
            BEGIN
                INSERT INTO dbo.InvoiceAttachments
                    (Id, InvoiceId, OpenInvoiceAttachmentId, FileName, ContentType, SizeBytes, StoragePath, BodyHash, CreatedAtUtc)
                VALUES
                    (@Id, @InvoiceId, @OpenInvoiceAttachmentId, @FileName, @ContentType, @SizeBytes, @StoragePath, @BodyHash, SYSUTCDATETIME());
            END
            """;
        attachmentInsert.Parameters.AddWithValue("@Id", Guid.NewGuid());
        attachmentInsert.Parameters.AddWithValue("@InvoiceId", invoiceId.Value);
        attachmentInsert.Parameters.AddWithValue("@OpenInvoiceAttachmentId", attachment.AttachmentId);
        attachmentInsert.Parameters.AddWithValue("@FileName", attachment.FileName);
        attachmentInsert.Parameters.AddWithValue("@ContentType", attachment.ContentType);
        attachmentInsert.Parameters.AddWithValue("@SizeBytes", sizeBytes);
        attachmentInsert.Parameters.AddWithValue("@StoragePath", storagePath);
        attachmentInsert.Parameters.AddWithValue("@BodyHash", bodyHash);
        await attachmentInsert.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task UpsertOpenInvoiceSnapshotAsync(string invoiceNumber, string storagePath, string contentType, long sizeBytes, string bodyHash, CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);

        var invoiceId = await GetInvoiceIdByNumberAsync(connection, invoiceNumber, cancellationToken);
        if (invoiceId is null)
        {
            return;
        }

        await using var deleteCommand = connection.CreateCommand();
        deleteCommand.CommandText = "DELETE FROM dbo.InvoiceSnapshots WHERE InvoiceId = @InvoiceId;";
        deleteCommand.Parameters.AddWithValue("@InvoiceId", invoiceId.Value);
        await deleteCommand.ExecuteNonQueryAsync(cancellationToken);

        await using var insertCommand = connection.CreateCommand();
        insertCommand.CommandText = """
            INSERT INTO dbo.InvoiceSnapshots
                (Id, InvoiceId, StoragePath, ContentType, SizeBytes, BodyHash, CreatedAtUtc)
            VALUES
                (@Id, @InvoiceId, @StoragePath, @ContentType, @SizeBytes, @BodyHash, SYSUTCDATETIME());
            """;
        insertCommand.Parameters.AddWithValue("@Id", Guid.NewGuid());
        insertCommand.Parameters.AddWithValue("@InvoiceId", invoiceId.Value);
        insertCommand.Parameters.AddWithValue("@StoragePath", storagePath);
        insertCommand.Parameters.AddWithValue("@ContentType", contentType);
        insertCommand.Parameters.AddWithValue("@SizeBytes", sizeBytes);
        insertCommand.Parameters.AddWithValue("@BodyHash", bodyHash);
        await insertCommand.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<QueueItemDto>> GetQueueAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = SqlConnectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT InvoiceId, InvoiceNumber, VendorCode, Status, UpdatedAtUtc
                FROM dbo.Invoice
                WHERE Status IN ('PendingReview', 'SentBack')
                ORDER BY UpdatedAtUtc ASC, InvoiceNumber ASC;
                """;

            var items = new List<QueueItemDto>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var status = reader.GetStringValue("Status");
                var reason = status == "SentBack" ? "Returned for correction" : "Needs analyst review";
                items.Add(new QueueItemDto(
                    reader.GetGuidValue("InvoiceId"),
                    reader.GetStringValue("InvoiceNumber"),
                    reader.GetStringValue("VendorCode"),
                    reason,
                    reader.GetDateTimeOffsetValue("UpdatedAtUtc")));
            }

            return items;
        }
        catch (SqlException exception)
        {
            logger.LogError(exception, "Failed while loading invoice queue.");
            throw SqlFailureHandling.CreateException(exception, "loading the invoice queue");
        }
    }

    public async Task<SyncStatusDto> GetStatusAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = SqlConnectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);

            DateTimeOffset? lastSuccessfulRunUtc = null;
            var pendingItems = 0;
            var failedItems = 0;

            await using (var command = connection.CreateCommand())
            {
                command.CommandText = """
                    SELECT
                        (SELECT TOP (1) LastRunUtc FROM dbo.SyncCheckpoint ORDER BY LastRunUtc DESC) AS LastRunUtc,
                        (SELECT COUNT(*) FROM dbo.Invoice WHERE Status IN ('PendingReview', 'SentBack')) AS PendingItems,
                        (SELECT COUNT(*) FROM dbo.SyncError) AS FailedItems;
                    """;

                await using var reader = await command.ExecuteReaderAsync(cancellationToken);
                if (await reader.ReadAsync(cancellationToken))
                {
                    lastSuccessfulRunUtc = reader.IsDBNull(reader.GetOrdinal("LastRunUtc"))
                        ? null
                        : new DateTimeOffset(reader.GetDateTime(reader.GetOrdinal("LastRunUtc")), TimeSpan.Zero);
                    pendingItems = reader.GetInt32(reader.GetOrdinal("PendingItems"));
                    failedItems = reader.GetInt32(reader.GetOrdinal("FailedItems"));
                }
            }

            return new SyncStatusDto(
                failedItems > 0 ? "AttentionRequired" : "Healthy",
                lastSuccessfulRunUtc ?? DateTimeOffset.UtcNow.AddHours(-1),
                pendingItems,
                failedItems);
        }
        catch (SqlException exception)
        {
            logger.LogError(exception, "Failed while loading sync status.");
            return new SyncStatusDto(
                SqlFailureHandling.IsSchemaError(exception) ? "DatabaseNotInitialized" : "Unavailable",
                DateTimeOffset.UtcNow.AddHours(-1),
                0,
                0);
        }
    }

    private async Task<bool> UpdateStatusAsync(Guid invoiceId, string status, CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = SqlConnectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText = """
                UPDATE dbo.Invoice
                SET Status = @Status,
                    UpdatedAtUtc = SYSUTCDATETIME()
                WHERE InvoiceId = @InvoiceId;
                """;
            command.Parameters.AddWithValue("@InvoiceId", invoiceId);
            command.Parameters.AddWithValue("@Status", status);

            var rows = await command.ExecuteNonQueryAsync(cancellationToken);
            return rows > 0;
        }
        catch (SqlException exception)
        {
            logger.LogError(exception, "Failed while updating invoice status for {InvoiceId}.", invoiceId);
            throw SqlFailureHandling.CreateException(exception, "updating invoice status");
        }
    }

    private async Task<bool> UpdateStatusAndEnqueueAsync(Guid invoiceId, string status, string eventType, object payload, CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = SqlConnectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);

            await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

            try
            {
                string? openInvoiceDocumentId = null;
                string invoiceNumber = string.Empty;
                string supplierNumber = string.Empty;

                await using (var contextCommand = connection.CreateCommand())
                {
                    contextCommand.Transaction = transaction;
                    contextCommand.CommandText = """
                        SELECT OpenInvoiceDocumentId, InvoiceNumber, VendorCode
                        FROM dbo.Invoice
                        WHERE InvoiceId = @InvoiceId;
                        """;
                    contextCommand.Parameters.AddWithValue("@InvoiceId", invoiceId);

                    await using var reader = await contextCommand.ExecuteReaderAsync(cancellationToken);
                    if (await reader.ReadAsync(cancellationToken))
                    {
                        openInvoiceDocumentId = reader.GetNullableStringValue("OpenInvoiceDocumentId");
                        invoiceNumber = reader.GetStringValue("InvoiceNumber");
                        supplierNumber = reader.GetStringValue("VendorCode");
                    }
                }

                await using (var command = connection.CreateCommand())
                {
                    command.Transaction = transaction;
                    command.CommandText = """
                        UPDATE dbo.Invoice
                        SET Status = @Status,
                            UpdatedAtUtc = SYSUTCDATETIME()
                        WHERE InvoiceId = @InvoiceId;
                        """;
                    command.Parameters.AddWithValue("@InvoiceId", invoiceId);
                    command.Parameters.AddWithValue("@Status", status);
                    var rows = await command.ExecuteNonQueryAsync(cancellationToken);
                    if (rows == 0)
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        return false;
                    }
                }

                await using (var outboxCommand = connection.CreateCommand())
                {
                    outboxCommand.Transaction = transaction;
                    outboxCommand.CommandText = """
                        INSERT INTO dbo.OpenInvoiceEventOutbox
                            (Id, OpenInvoiceDocumentId, EventType, PayloadJson, Status, AttemptCount, CreatedAtUtc)
                        VALUES
                            (@Id, @OpenInvoiceDocumentId, @EventType, @PayloadJson, @Status, 0, SYSUTCDATETIME());
                    """;
                    outboxCommand.Parameters.AddWithValue("@Id", Guid.NewGuid());
                    outboxCommand.Parameters.AddWithValue("@OpenInvoiceDocumentId", (object?)openInvoiceDocumentId ?? invoiceId.ToString());
                    outboxCommand.Parameters.AddWithValue("@EventType", eventType);
                    outboxCommand.Parameters.AddWithValue("@PayloadJson", System.Text.Json.JsonSerializer.Serialize(new
                    {
                        context = new
                        {
                            documentId = openInvoiceDocumentId ?? invoiceId.ToString(),
                            invoiceNumber,
                            supplierNumber
                        },
                        transform = payload
                    }));
                    outboxCommand.Parameters.AddWithValue("@Status", "Pending");
                    await outboxCommand.ExecuteNonQueryAsync(cancellationToken);
                }

                await transaction.CommitAsync(cancellationToken);
                return true;
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        }
        catch (SqlException exception)
        {
            logger.LogError(exception, "Failed while updating invoice {InvoiceId} and enqueueing {EventType}.", invoiceId, eventType);
            throw SqlFailureHandling.CreateException(exception, "updating invoice workflow state");
        }
    }

    private static string MapStatus(string status)
    {
        return status.ToLowerInvariant() switch
        {
            "approved" => "Approved",
            "disputed" => "SentBack",
            "submitted" => "PendingReview",
            "resubmitted" => "PendingReview",
            "cancelled" => "SentBack",
            "deleted" => "SentBack",
            _ => "PendingReview"
        };
    }

    private static async Task<Guid?> GetInvoiceIdByNumberAsync(SqlConnection connection, string invoiceNumber, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT TOP (1) InvoiceId FROM dbo.Invoice WHERE InvoiceNumber = @InvoiceNumber;";
        command.Parameters.AddWithValue("@InvoiceNumber", invoiceNumber);
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return value is Guid id ? id : null;
    }

    private static async Task ReplaceInvoiceLinesAsync(SqlConnection connection, Guid invoiceId, IReadOnlyList<OpenInvoiceLineItemSnapshot> lineItems, CancellationToken cancellationToken)
    {
        await using (var deleteCommand = connection.CreateCommand())
        {
            deleteCommand.CommandText = "DELETE FROM dbo.InvoiceLine WHERE InvoiceId = @InvoiceId;";
            deleteCommand.Parameters.AddWithValue("@InvoiceId", invoiceId);
            await deleteCommand.ExecuteNonQueryAsync(cancellationToken);
        }

        foreach (var line in lineItems)
        {
            await using var insertCommand = connection.CreateCommand();
            insertCommand.CommandText = """
                INSERT INTO dbo.InvoiceLine
                    (InvoiceLineId, InvoiceId, LineNumber, Description, Quantity, UnitPrice, Amount, CreatedAtUtc)
                VALUES
                    (@InvoiceLineId, @InvoiceId, @LineNumber, @Description, @Quantity, @UnitPrice, @Amount, SYSUTCDATETIME());
                """;
            insertCommand.Parameters.AddWithValue("@InvoiceLineId", Guid.NewGuid());
            insertCommand.Parameters.AddWithValue("@InvoiceId", invoiceId);
            insertCommand.Parameters.AddWithValue("@LineNumber", line.LineNumber);
            insertCommand.Parameters.AddWithValue("@Description", (object?)line.Description ?? DBNull.Value);
            insertCommand.Parameters.AddWithValue("@Quantity", line.Quantity);
            insertCommand.Parameters.AddWithValue("@UnitPrice", line.UnitPrice);
            insertCommand.Parameters.AddWithValue("@Amount", line.Amount);
            await insertCommand.ExecuteNonQueryAsync(cancellationToken);
        }
    }
}
