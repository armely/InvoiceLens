using System.Globalization;
using InvoiceLens.Application.Documents;
using InvoiceLens.Application.InvoiceComparison;
using InvoiceLens.Infrastructure.LocalInvoices;
using InvoiceLens.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace InvoiceLens.Infrastructure.InvoiceComparison;

internal sealed class SqlInvoiceComparisonService(
    LocalInvoiceFileReader localInvoiceFileReader,
    LocalInvoiceComparisonOptions options,
    ILogger<SqlInvoiceComparisonService> logger) : IInvoiceComparisonService
{
    public async Task<IReadOnlyList<LocalInvoiceFileDto>> GetLocalInvoicesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = SqlConnectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT
                    f.LocalInvoiceFileId,
                    f.FileName,
                    f.FilePath,
                    f.MetadataPath,
                    f.InvoiceNumber,
                    f.SupplierNumber,
                    f.SupplierName,
                    f.TotalAmount,
                    f.LoadedAtUtc,
                    latest.CreatedAtUtc AS LastComparedAtUtc,
                    latest.MatchStatus,
                    latest.OverallStatus,
                    latest.MatchScore
                FROM dbo.LocalInvoiceFiles AS f
                OUTER APPLY (
                    SELECT TOP (1) r.CreatedAtUtc, r.MatchStatus, r.OverallStatus, r.MatchScore
                    FROM dbo.InvoiceComparisonRuns AS r
                    WHERE r.LocalInvoiceFileId = f.LocalInvoiceFileId
                    ORDER BY r.CreatedAtUtc DESC, r.ComparisonRunId DESC
                ) AS latest
                ORDER BY f.LoadedAtUtc DESC, f.FileName ASC;
                """;

            var rows = new List<LocalInvoiceFileDto>();
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                rows.Add(new LocalInvoiceFileDto(
                    reader.GetInt32Value("LocalInvoiceFileId"),
                    reader.GetStringValue("FileName"),
                    reader.GetStringValue("FilePath"),
                    reader.GetNullableStringValue("MetadataPath"),
                    reader.GetNullableStringValue("InvoiceNumber"),
                    reader.GetNullableStringValue("SupplierNumber"),
                    reader.GetNullableStringValue("SupplierName"),
                    reader.IsDBNull(reader.GetOrdinal("TotalAmount")) ? null : reader.GetDecimalValue("TotalAmount"),
                    reader.GetDateTimeOffsetValue("LoadedAtUtc"),
                    reader.GetNullableDateTimeOffsetValue("LastComparedAtUtc"),
                    reader.GetNullableStringValue("MatchStatus"),
                    reader.GetNullableStringValue("OverallStatus"),
                    reader.IsDBNull(reader.GetOrdinal("MatchScore")) ? null : reader.GetDecimalValue("MatchScore")));
            }

            return rows;
        }
        catch (SqlException exception)
        {
            logger.LogError(exception, "Failed while loading local invoice files.");
            throw SqlFailureHandling.CreateException(exception, "loading local invoice files");
        }
    }

    public async Task<int> LoadLocalInvoicesAsync(CancellationToken cancellationToken)
    {
        var snapshots = await localInvoiceFileReader.DiscoverAsync(cancellationToken);
        if (snapshots.Count == 0)
        {
            return 0;
        }

        try
        {
            var loaded = 0;
            await using var connection = SqlConnectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);

            foreach (var snapshot in snapshots)
            {
                var fileId = await UpsertLocalInvoiceAsync(connection, snapshot, cancellationToken);
                if (fileId > 0)
                {
                    loaded++;
                }
            }

            return loaded;
        }
        catch (SqlException exception)
        {
            logger.LogError(exception, "Failed while loading local invoices into SQL.");
            throw SqlFailureHandling.CreateException(exception, "loading local invoices");
        }
    }

    public async Task<DocumentStreamResult?> GetLocalInvoicePdfAsync(int localInvoiceFileId, CancellationToken cancellationToken)
    {
        var localRecord = await LoadLocalInvoiceRecordAsync(localInvoiceFileId, cancellationToken);
        if (localRecord is null || !File.Exists(localRecord.FilePath))
        {
            return null;
        }

        return new DocumentStreamResult(
            localRecord.FileName,
            "application/pdf",
            File.OpenRead(localRecord.FilePath));
    }

    public async Task<InvoiceComparisonRunDto?> RunComparisonAsync(int localInvoiceFileId, CancellationToken cancellationToken)
    {
        var localRecord = await LoadLocalInvoiceRecordAsync(localInvoiceFileId, cancellationToken);
        if (localRecord is null)
        {
            return null;
        }

        var metadataSnapshot = await localInvoiceFileReader.ReadByMetadataPathAsync(localRecord.MetadataPath, cancellationToken);
        if (metadataSnapshot is null)
        {
            return await SaveComparisonAsync(localRecord, null, null, "No Match Found", "Fail", null, new[]
            {
                new InvoiceComparisonResultDto(
                    "MISSING_VENDOR_INVOICE",
                    "Local invoice metadata",
                    "Fail",
                    "Critical",
                    localRecord.MetadataPath,
                    null,
                    "The metadata file could not be found or could not be parsed.")
            }, cancellationToken);
        }

        var localInvoice = MapLocalInvoice(metadataSnapshot);
        var systemInvoices = await LoadSystemInvoicesAsync(cancellationToken);
        var match = FindBestMatch(localInvoice, systemInvoices);
        var selectedSystemInvoice = match.SystemInvoice;
        var results = BuildComparisonResults(localInvoice, selectedSystemInvoice, match);
        var overallStatus = SummarizeOverallStatus(results);

        return await SaveComparisonAsync(
            localRecord,
            selectedSystemInvoice?.InvoiceId,
            selectedSystemInvoice,
            match.MatchStatus,
            overallStatus,
            match.MatchScore,
            results,
            cancellationToken);
    }

    public async Task<InvoiceComparisonRunDto?> GetComparisonRunAsync(int comparisonRunId, CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = SqlConnectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT
                    r.ComparisonRunId,
                    r.LocalInvoiceFileId,
                    r.SystemInvoiceId,
                    r.MatchStatus,
                    r.OverallStatus,
                    r.MatchScore,
                    r.CreatedAtUtc,
                    f.FileName,
                    f.FilePath,
                    f.MetadataPath,
                    f.InvoiceNumber,
                    f.SupplierNumber,
                    f.SupplierName,
                    f.TotalAmount,
                    f.LoadedAtUtc,
                    latest.CreatedAtUtc AS LastComparedAtUtc,
                    latest.MatchStatus AS LastMatchStatus,
                    latest.OverallStatus AS LastOverallStatus,
                    latest.MatchScore AS LastMatchScore
                FROM dbo.InvoiceComparisonRuns AS r
                INNER JOIN dbo.LocalInvoiceFiles AS f ON f.LocalInvoiceFileId = r.LocalInvoiceFileId
                OUTER APPLY (
                    SELECT TOP (1) r2.CreatedAtUtc, r2.MatchStatus, r2.OverallStatus, r2.MatchScore
                    FROM dbo.InvoiceComparisonRuns AS r2
                    WHERE r2.LocalInvoiceFileId = r.LocalInvoiceFileId
                    ORDER BY r2.CreatedAtUtc DESC, r2.ComparisonRunId DESC
                ) AS latest
                WHERE r.ComparisonRunId = @ComparisonRunId;
                """;
            command.Parameters.AddWithValue("@ComparisonRunId", comparisonRunId);

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return null;
            }

            var localInvoiceFile = new LocalInvoiceFileDto(
                reader.GetInt32Value("LocalInvoiceFileId"),
                reader.GetStringValue("FileName"),
                reader.GetStringValue("FilePath"),
                reader.GetNullableStringValue("MetadataPath"),
                reader.GetNullableStringValue("InvoiceNumber"),
                reader.GetNullableStringValue("SupplierNumber"),
                reader.GetNullableStringValue("SupplierName"),
                reader.IsDBNull(reader.GetOrdinal("TotalAmount")) ? null : reader.GetDecimalValue("TotalAmount"),
                reader.GetDateTimeOffsetValue("LoadedAtUtc"),
                reader.GetNullableDateTimeOffsetValue("LastComparedAtUtc"),
                reader.GetNullableStringValue("LastMatchStatus"),
                reader.GetNullableStringValue("LastOverallStatus"),
                reader.IsDBNull(reader.GetOrdinal("LastMatchScore")) ? null : reader.GetDecimalValue("LastMatchScore"));

            Guid? systemInvoiceId = reader.IsDBNull(reader.GetOrdinal("SystemInvoiceId")) ? null : reader.GetGuidValue("SystemInvoiceId");
            var systemInvoice = systemInvoiceId is null ? null : await LoadSystemInvoiceAsync(systemInvoiceId.Value, cancellationToken);
            var results = await LoadComparisonResultsAsync(connection, comparisonRunId, cancellationToken);

            return new InvoiceComparisonRunDto(
                reader.GetInt32Value("ComparisonRunId"),
                localInvoiceFile,
                systemInvoiceId,
                reader.GetStringValue("MatchStatus"),
                reader.GetStringValue("OverallStatus"),
                reader.IsDBNull(reader.GetOrdinal("MatchScore")) ? null : reader.GetDecimalValue("MatchScore"),
                reader.GetDateTimeOffsetValue("CreatedAtUtc"),
                systemInvoice,
                results);
        }
        catch (SqlException exception)
        {
            logger.LogError(exception, "Failed while loading comparison run {ComparisonRunId}.", comparisonRunId);
            throw SqlFailureHandling.CreateException(exception, "loading invoice comparison results");
        }
    }

    private async Task<LocalInvoiceFileRecord?> LoadLocalInvoiceRecordAsync(int localInvoiceFileId, CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = SqlConnectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT LocalInvoiceFileId, FileName, FilePath, MetadataPath, InvoiceNumber, SupplierNumber, SupplierName, TotalAmount, LoadedAtUtc
                FROM dbo.LocalInvoiceFiles
                WHERE LocalInvoiceFileId = @LocalInvoiceFileId;
                """;
            command.Parameters.AddWithValue("@LocalInvoiceFileId", localInvoiceFileId);

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return null;
            }

            return new LocalInvoiceFileRecord(
                reader.GetInt32Value("LocalInvoiceFileId"),
                reader.GetStringValue("FileName"),
                reader.GetStringValue("FilePath"),
                reader.GetStringValue("MetadataPath"),
                reader.GetNullableStringValue("InvoiceNumber"),
                reader.GetNullableStringValue("SupplierNumber"),
                reader.GetNullableStringValue("SupplierName"),
                reader.IsDBNull(reader.GetOrdinal("TotalAmount")) ? null : reader.GetDecimalValue("TotalAmount"),
                reader.GetDateTimeOffsetValue("LoadedAtUtc"));
        }
        catch (SqlException exception)
        {
            logger.LogError(exception, "Failed while loading local invoice record {LocalInvoiceFileId}.", localInvoiceFileId);
            throw SqlFailureHandling.CreateException(exception, "loading a local invoice record");
        }
    }

    private async Task<int> UpsertLocalInvoiceAsync(SqlConnection connection, LocalInvoiceMetadataSnapshot snapshot, CancellationToken cancellationToken)
    {
        var existingId = await GetLocalInvoiceIdByFileNameAsync(connection, snapshot.Metadata.FileName, cancellationToken);

        if (existingId is null)
        {
            await using var insertCommand = connection.CreateCommand();
            insertCommand.CommandText = """
                INSERT INTO dbo.LocalInvoiceFiles
                    (FileName, FilePath, MetadataPath, InvoiceNumber, SupplierNumber, SupplierName, TotalAmount, LoadedAtUtc)
                OUTPUT INSERTED.LocalInvoiceFileId
                VALUES
                    (@FileName, @FilePath, @MetadataPath, @InvoiceNumber, @SupplierNumber, @SupplierName, @TotalAmount, SYSUTCDATETIME());
                """;
            AddLocalInvoiceParameters(insertCommand, snapshot);
            var inserted = await insertCommand.ExecuteScalarAsync(cancellationToken);
            return inserted is int insertedId ? insertedId : 0;
        }

        await using (var updateCommand = connection.CreateCommand())
        {
            updateCommand.CommandText = """
                UPDATE dbo.LocalInvoiceFiles
                SET FilePath = @FilePath,
                    MetadataPath = @MetadataPath,
                    InvoiceNumber = @InvoiceNumber,
                    SupplierNumber = @SupplierNumber,
                    SupplierName = @SupplierName,
                    TotalAmount = @TotalAmount
                WHERE LocalInvoiceFileId = @LocalInvoiceFileId;
                """;
            updateCommand.Parameters.AddWithValue("@LocalInvoiceFileId", existingId.Value);
            AddLocalInvoiceParameters(updateCommand, snapshot);
            await updateCommand.ExecuteNonQueryAsync(cancellationToken);
        }

        return existingId.Value;
    }

    private static void AddLocalInvoiceParameters(SqlCommand command, LocalInvoiceMetadataSnapshot snapshot)
    {
        command.Parameters.AddWithValue("@FileName", snapshot.Metadata.FileName);
        command.Parameters.AddWithValue("@FilePath", snapshot.PdfPath);
        command.Parameters.AddWithValue("@MetadataPath", snapshot.MetadataPath);
        command.Parameters.AddWithValue("@InvoiceNumber", snapshot.Metadata.InvoiceNumber);
        command.Parameters.AddWithValue("@SupplierNumber", (object?)snapshot.Metadata.SupplierNumber ?? DBNull.Value);
        command.Parameters.AddWithValue("@SupplierName", (object?)snapshot.Metadata.SupplierName ?? DBNull.Value);
        command.Parameters.AddWithValue("@TotalAmount", (object?)snapshot.Metadata.TotalAmount ?? DBNull.Value);
    }

    private async Task<int?> GetLocalInvoiceIdByFileNameAsync(SqlConnection connection, string fileName, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT TOP (1) LocalInvoiceFileId FROM dbo.LocalInvoiceFiles WHERE FileName = @FileName;";
        command.Parameters.AddWithValue("@FileName", fileName);
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return value is int id ? id : null;
    }

    private async Task<InvoiceComparisonRunDto> SaveComparisonAsync(
        LocalInvoiceFileRecord localRecord,
        Guid? systemInvoiceId,
        NormalizedInvoice? systemInvoice,
        string matchStatus,
        string overallStatus,
        decimal? matchScore,
        IReadOnlyList<InvoiceComparisonResultDto> results,
        CancellationToken cancellationToken)
    {
        await using var connection = SqlConnectionFactory.CreateConnection();
        await connection.OpenAsync(cancellationToken);
        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(cancellationToken);

        try
        {
            int comparisonRunId;
            await using (var runCommand = connection.CreateCommand())
            {
                runCommand.Transaction = transaction;
                runCommand.CommandText = """
                    INSERT INTO dbo.InvoiceComparisonRuns
                        (LocalInvoiceFileId, SystemInvoiceId, MatchStatus, OverallStatus, MatchScore, CreatedAtUtc)
                    OUTPUT INSERTED.ComparisonRunId
                    VALUES
                        (@LocalInvoiceFileId, @SystemInvoiceId, @MatchStatus, @OverallStatus, @MatchScore, SYSUTCDATETIME());
                    """;
                runCommand.Parameters.AddWithValue("@LocalInvoiceFileId", localRecord.LocalInvoiceFileId);
                runCommand.Parameters.AddWithValue("@SystemInvoiceId", (object?)systemInvoiceId ?? DBNull.Value);
                runCommand.Parameters.AddWithValue("@MatchStatus", matchStatus);
                runCommand.Parameters.AddWithValue("@OverallStatus", overallStatus);
                runCommand.Parameters.AddWithValue("@MatchScore", (object?)matchScore ?? DBNull.Value);

                var inserted = await runCommand.ExecuteScalarAsync(cancellationToken);
                comparisonRunId = inserted is int id ? id : 0;
            }

            if (comparisonRunId == 0)
            {
                await transaction.RollbackAsync(cancellationToken);
                throw new InvalidOperationException("The comparison run could not be saved.");
            }

            foreach (var result in results)
            {
                await using var resultCommand = connection.CreateCommand();
                resultCommand.Transaction = transaction;
                resultCommand.CommandText = """
                    INSERT INTO dbo.InvoiceComparisonResults
                        (ComparisonRunId, RuleCode, Label, Status, Severity, LocalValue, SystemValue, Message)
                    VALUES
                        (@ComparisonRunId, @RuleCode, @Label, @Status, @Severity, @LocalValue, @SystemValue, @Message);
                    """;
                resultCommand.Parameters.AddWithValue("@ComparisonRunId", comparisonRunId);
                resultCommand.Parameters.AddWithValue("@RuleCode", result.RuleCode);
                resultCommand.Parameters.AddWithValue("@Label", result.Label);
                resultCommand.Parameters.AddWithValue("@Status", result.Status);
                resultCommand.Parameters.AddWithValue("@Severity", result.Severity);
                resultCommand.Parameters.AddWithValue("@LocalValue", (object?)result.LocalValue ?? DBNull.Value);
                resultCommand.Parameters.AddWithValue("@SystemValue", (object?)result.SystemValue ?? DBNull.Value);
                resultCommand.Parameters.AddWithValue("@Message", (object?)result.Message ?? DBNull.Value);
                await resultCommand.ExecuteNonQueryAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
            return new InvoiceComparisonRunDto(
                comparisonRunId,
                new LocalInvoiceFileDto(
                    localRecord.LocalInvoiceFileId,
                    localRecord.FileName,
                    localRecord.FilePath,
                    localRecord.MetadataPath,
                    localRecord.InvoiceNumber,
                    localRecord.SupplierNumber,
                    localRecord.SupplierName,
                    localRecord.TotalAmount,
                    localRecord.LoadedAtUtc,
                    DateTimeOffset.UtcNow,
                    matchStatus,
                    overallStatus,
                    matchScore),
                systemInvoiceId,
                matchStatus,
                overallStatus,
                matchScore,
                DateTimeOffset.UtcNow,
                systemInvoice,
                results);
        }
        catch
        {
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    private async Task<LocalInvoiceFileDto> BuildLocalInvoiceDtoAsync(LocalInvoiceFileRecord localRecord, CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = SqlConnectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT
                    f.LocalInvoiceFileId,
                    f.FileName,
                    f.FilePath,
                    f.MetadataPath,
                    f.InvoiceNumber,
                    f.SupplierNumber,
                    f.SupplierName,
                    f.TotalAmount,
                    f.LoadedAtUtc,
                    latest.CreatedAtUtc AS LastComparedAtUtc,
                    latest.MatchStatus,
                    latest.OverallStatus,
                    latest.MatchScore
                FROM dbo.LocalInvoiceFiles AS f
                OUTER APPLY (
                    SELECT TOP (1) r.CreatedAtUtc, r.MatchStatus, r.OverallStatus, r.MatchScore
                    FROM dbo.InvoiceComparisonRuns AS r
                    WHERE r.LocalInvoiceFileId = f.LocalInvoiceFileId
                    ORDER BY r.CreatedAtUtc DESC, r.ComparisonRunId DESC
                ) AS latest
                WHERE f.LocalInvoiceFileId = @LocalInvoiceFileId;
                """;
            command.Parameters.AddWithValue("@LocalInvoiceFileId", localRecord.LocalInvoiceFileId);

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (await reader.ReadAsync(cancellationToken))
            {
                return new LocalInvoiceFileDto(
                    reader.GetInt32Value("LocalInvoiceFileId"),
                    reader.GetStringValue("FileName"),
                    reader.GetStringValue("FilePath"),
                    reader.GetNullableStringValue("MetadataPath"),
                    reader.GetNullableStringValue("InvoiceNumber"),
                    reader.GetNullableStringValue("SupplierNumber"),
                    reader.GetNullableStringValue("SupplierName"),
                    reader.IsDBNull(reader.GetOrdinal("TotalAmount")) ? null : reader.GetDecimalValue("TotalAmount"),
                    reader.GetDateTimeOffsetValue("LoadedAtUtc"),
                    reader.GetNullableDateTimeOffsetValue("LastComparedAtUtc"),
                    reader.GetNullableStringValue("MatchStatus"),
                    reader.GetNullableStringValue("OverallStatus"),
                    reader.IsDBNull(reader.GetOrdinal("MatchScore")) ? null : reader.GetDecimalValue("MatchScore"));
            }
        }
        catch (SqlException exception)
        {
            // Fall back to the in-memory record below.
            logger.LogWarning(exception, "Failed while enriching local invoice file {LocalInvoiceFileId}; using in-memory fallback.", localRecord.LocalInvoiceFileId);
        }

        return new LocalInvoiceFileDto(
            localRecord.LocalInvoiceFileId,
            localRecord.FileName,
            localRecord.FilePath,
            localRecord.MetadataPath,
            localRecord.InvoiceNumber,
            localRecord.SupplierNumber,
            localRecord.SupplierName,
            localRecord.TotalAmount,
            localRecord.LoadedAtUtc,
            null,
            null,
            null,
            null);
    }

    private async Task<IReadOnlyList<InvoiceComparisonResultDto>> LoadComparisonResultsAsync(SqlConnection connection, int comparisonRunId, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT RuleCode, Label, Status, Severity, LocalValue, SystemValue, Message
            FROM dbo.InvoiceComparisonResults
            WHERE ComparisonRunId = @ComparisonRunId
            ORDER BY ComparisonResultId ASC;
            """;
        command.Parameters.AddWithValue("@ComparisonRunId", comparisonRunId);

        var results = new List<InvoiceComparisonResultDto>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new InvoiceComparisonResultDto(
                reader.GetStringValue("RuleCode"),
                reader.GetStringValue("Label"),
                reader.GetStringValue("Status"),
                reader.GetStringValue("Severity"),
                reader.GetNullableStringValue("LocalValue"),
                reader.GetNullableStringValue("SystemValue"),
                reader.GetNullableStringValue("Message")));
        }

        return results;
    }

    private async Task<IReadOnlyList<NormalizedInvoice>> LoadSystemInvoicesAsync(CancellationToken cancellationToken)
    {
        try
        {
            await using var connection = SqlConnectionFactory.CreateConnection();
            await connection.OpenAsync(cancellationToken);

            var invoices = new List<NormalizedInvoice>();
            var linesByInvoice = await LoadSystemLinesAsync(connection, cancellationToken);

            await using var command = connection.CreateCommand();
            command.CommandText = """
                SELECT InvoiceId, InvoiceNumber, VendorCode, CompanyCode, AfeCode, TotalAmount, CurrencyCode, Status, CreatedAtUtc, UpdatedAtUtc
                FROM dbo.Invoice
                ORDER BY UpdatedAtUtc DESC, InvoiceNumber ASC;
                """;

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                var invoiceId = reader.GetGuidValue("InvoiceId");
                invoices.Add(new NormalizedInvoice(
                    invoiceId,
                    reader.GetStringValue("InvoiceNumber"),
                    reader.GetStringValue("VendorCode"),
                    reader.GetStringValue("VendorCode"),
                    new DateTimeOffset(reader.GetDateTime(reader.GetOrdinal("CreatedAtUtc")), TimeSpan.Zero),
                    null,
                    reader.GetNullableStringValue("AfeCode"),
                    reader.GetStringValue("CompanyCode"),
                    reader.GetStringValue("CurrencyCode"),
                    reader.GetDecimalValue("TotalAmount"),
                    0m,
                    reader.GetDecimalValue("TotalAmount"),
                    reader.GetStringValue("Status"),
                    NormalizeExportStatus(reader.GetStringValue("Status")),
                    NormalizePaymentStatus(reader.GetStringValue("Status")),
                    linesByInvoice.TryGetValue(invoiceId, out var lineItems) ? lineItems : Array.Empty<InvoiceLineItemDto>()));
            }

            return invoices;
        }
        catch (SqlException exception)
        {
            logger.LogError(exception, "Failed while loading system invoices for comparison.");
            throw SqlFailureHandling.CreateException(exception, "loading system invoices");
        }
    }

    private async Task<NormalizedInvoice?> LoadSystemInvoiceAsync(Guid invoiceId, CancellationToken cancellationToken)
    {
        var invoices = await LoadSystemInvoicesAsync(cancellationToken);
        return invoices.FirstOrDefault(invoice => invoice.InvoiceId == invoiceId);
    }

    private static async Task<Dictionary<Guid, IReadOnlyList<InvoiceLineItemDto>>> LoadSystemLinesAsync(SqlConnection connection, CancellationToken cancellationToken)
    {
        var lines = new Dictionary<Guid, List<InvoiceLineItemDto>>();

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT InvoiceId, LineNumber, Description, Quantity, UnitPrice, Amount
            FROM dbo.InvoiceLine
            ORDER BY InvoiceId, LineNumber ASC;
            """;

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var invoiceId = reader.GetGuidValue("InvoiceId");
            if (!lines.TryGetValue(invoiceId, out var invoiceLines))
            {
                invoiceLines = new List<InvoiceLineItemDto>();
                lines[invoiceId] = invoiceLines;
            }

            invoiceLines.Add(new InvoiceLineItemDto(
                reader.GetInt32Value("LineNumber"),
                reader.GetNullableStringValue("Description"),
                reader.GetDecimalValue("Quantity"),
                reader.GetDecimalValue("UnitPrice"),
                reader.GetDecimalValue("Amount"),
                null));
        }

        return lines.ToDictionary(entry => entry.Key, entry => (IReadOnlyList<InvoiceLineItemDto>)entry.Value);
    }

    private MatchCandidate FindBestMatch(NormalizedInvoice localInvoice, IReadOnlyList<NormalizedInvoice> systemInvoices)
    {
        if (systemInvoices.Count == 0)
        {
            return new MatchCandidate(null, "No Match Found", null);
        }

        var scoredMatches = systemInvoices
            .Select(systemInvoice => new
            {
                Invoice = systemInvoice,
                Score = CalculateMatchScore(localInvoice, systemInvoice)
            })
            .Where(entry => entry.Score > 0)
            .OrderByDescending(entry => entry.Score)
            .ThenBy(entry => entry.Invoice.InvoiceNumber, StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (scoredMatches.Count == 0)
        {
            return new MatchCandidate(null, "No Match Found", null);
        }

        var best = scoredMatches[0];
        var closeMatches = scoredMatches.Where(entry => entry.Score >= best.Score - 5).ToList();
        if (closeMatches.Count > 1)
        {
            return new MatchCandidate(best.Invoice, "Multiple Possible Matches", best.Score);
        }

        var strongMatch = IsStrongMatch(localInvoice, best.Invoice);
        return new MatchCandidate(best.Invoice, strongMatch ? "Strong Match" : "Weak Match", best.Score);
    }

    private decimal CalculateMatchScore(NormalizedInvoice localInvoice, NormalizedInvoice systemInvoice)
    {
        var score = 0m;

        if (EqualsNormalized(localInvoice.InvoiceNumber, systemInvoice.InvoiceNumber))
        {
            score += 70m;
        }

        if (!string.IsNullOrWhiteSpace(localInvoice.SupplierNumber) && EqualsNormalized(localInvoice.SupplierNumber, systemInvoice.SupplierNumber))
        {
            score += 20m;
        }
        else if (string.IsNullOrWhiteSpace(localInvoice.SupplierNumber) && EqualsNormalized(localInvoice.SupplierName, systemInvoice.SupplierName))
        {
            score += 15m;
        }

        if (EqualsNormalized(localInvoice.SupplierName, systemInvoice.SupplierName))
        {
            score += 10m;
        }

        if (localInvoice.TotalAmount.HasValue && systemInvoice.TotalAmount.HasValue && Math.Abs(localInvoice.TotalAmount.Value - systemInvoice.TotalAmount.Value) <= options.AmountTolerance)
        {
            score += 10m;
        }

        if (EqualsNormalized(localInvoice.PurchaseOrderNumber, systemInvoice.PurchaseOrderNumber))
        {
            score += 10m;
        }

        if (EqualsNormalized(localInvoice.AfeNumber, systemInvoice.AfeNumber))
        {
            score += 5m;
        }

        if (EqualsNormalized(localInvoice.CostCenter, systemInvoice.CostCenter))
        {
            score += 5m;
        }

        if (localInvoice.InvoiceDate.HasValue && systemInvoice.InvoiceDate.HasValue)
        {
            var dayDifference = Math.Abs((localInvoice.InvoiceDate.Value.UtcDateTime.Date - systemInvoice.InvoiceDate.Value.UtcDateTime.Date).TotalDays);
            if (dayDifference <= options.DateToleranceDays)
            {
                score += 5m;
            }
        }

        if (options.RequireSupplierNumber && string.IsNullOrWhiteSpace(localInvoice.SupplierNumber))
        {
            score = Math.Max(0m, score - 10m);
        }

        return score;
    }

    private bool IsStrongMatch(NormalizedInvoice localInvoice, NormalizedInvoice systemInvoice)
    {
        var invoiceNumberMatch = EqualsNormalized(localInvoice.InvoiceNumber, systemInvoice.InvoiceNumber);
        var supplierNumberMatch = !string.IsNullOrWhiteSpace(localInvoice.SupplierNumber)
            && EqualsNormalized(localInvoice.SupplierNumber, systemInvoice.SupplierNumber);

        return invoiceNumberMatch && supplierNumberMatch;
    }

    private IReadOnlyList<InvoiceComparisonResultDto> BuildComparisonResults(NormalizedInvoice localInvoice, NormalizedInvoice? systemInvoice, MatchCandidate match)
    {
        var results = new List<InvoiceComparisonResultDto>
        {
            new(
                systemInvoice is null ? "MISSING_CLIENT_RECORD" : "MATCH_STATUS",
                "Comparison summary",
                match.MatchStatus switch
                {
                    "Strong Match" => "Pass",
                    "Weak Match" => "Warning",
                    "Multiple Possible Matches" => "Warning",
                    _ => "Fail"
                },
                match.MatchStatus is "No Match Found" ? "Critical" : "High",
                localInvoice.InvoiceNumber,
                systemInvoice?.InvoiceNumber,
                match.MatchStatus is "No Match Found"
                    ? "No matching client SQL record was found."
                    : match.MatchStatus is "Multiple Possible Matches"
                        ? "Multiple possible system invoices were found for the local invoice."
                        : "A candidate system invoice was selected for comparison.")
        };

        if (systemInvoice is null)
        {
            return results;
        }

        results.Add(CompareTextField("INVOICE_NUMBER_MISMATCH", "Invoice number", localInvoice.InvoiceNumber, systemInvoice.InvoiceNumber, "Critical"));
        results.Add(CompareTextField("VENDOR_MISMATCH", "Vendor / supplier", localInvoice.SupplierName, systemInvoice.SupplierName, "Critical"));
        results.Add(CompareTextField("VENDOR_MISMATCH", "Vendor number", localInvoice.SupplierNumber, systemInvoice.SupplierNumber, "Critical"));
        results.Add(CompareDateField("INVOICE_DATE_MISMATCH", "Invoice date", localInvoice.InvoiceDate, systemInvoice.InvoiceDate, "Medium"));
        results.Add(CompareTextField("PO_MISMATCH", "Purchase order number", localInvoice.PurchaseOrderNumber, systemInvoice.PurchaseOrderNumber, "Medium"));
        results.Add(CompareTextField("AFE_MISMATCH", "AFE number", localInvoice.AfeNumber, systemInvoice.AfeNumber, "High"));
        results.Add(CompareTextField("COST_CENTER_MISMATCH", "Cost center", localInvoice.CostCenter, systemInvoice.CostCenter, "High"));
        results.Add(CompareTextField("CURRENCY_MISMATCH", "Currency", localInvoice.Currency, systemInvoice.Currency, "Critical"));
        results.Add(CompareAmountField("AMOUNT_MISMATCH", "Subtotal", localInvoice.Subtotal, systemInvoice.Subtotal, "Medium"));
        results.Add(CompareAmountField("AMOUNT_MISMATCH", "Tax", localInvoice.Tax, systemInvoice.Tax, "Medium"));
        results.Add(CompareAmountField("AMOUNT_MISMATCH", "Total amount", localInvoice.TotalAmount, systemInvoice.TotalAmount, "Critical"));
        results.Add(CompareTextField("STATUS_MISMATCH", "Status", localInvoice.Status, systemInvoice.Status, "High"));
        results.Add(CompareTextField("EXPORT_STATUS_MISMATCH", "Export status", localInvoice.ExportStatus, systemInvoice.ExportStatus, "Low"));
        results.Add(CompareTextField("PAYMENT_STATUS_MISMATCH", "Payment status", localInvoice.PaymentStatus, systemInvoice.PaymentStatus, "Low"));

        results.Add(new InvoiceComparisonResultDto(
            "W9_COMPLIANCE_ISSUE",
            "W-9 / vendor compliance",
            "Not Available",
            "High",
            localInvoice.SupplierNumber,
            systemInvoice.SupplierNumber,
            "W-9/compliance data is not yet modeled in the SQL client records."));

        results.Add(CompareLineCount(localInvoice.LineItems, systemInvoice.LineItems));
        results.AddRange(CompareLineItems(localInvoice.LineItems, systemInvoice.LineItems));

        return results;
    }

    private InvoiceComparisonResultDto CompareLineCount(IReadOnlyList<InvoiceLineItemDto> localLines, IReadOnlyList<InvoiceLineItemDto> systemLines)
    {
        var label = "Line item count";
        if (localLines.Count == 0 && systemLines.Count == 0)
        {
            return new InvoiceComparisonResultDto("LINE_ITEM_MISMATCH", label, "Not Available", "Low", null, null, "No line items were available on either side.");
        }

        if (localLines.Count == systemLines.Count)
        {
            return new InvoiceComparisonResultDto("LINE_ITEM_MISMATCH", label, "Pass", "Low", localLines.Count.ToString(CultureInfo.InvariantCulture), systemLines.Count.ToString(CultureInfo.InvariantCulture), "Line item counts match.");
        }

        return new InvoiceComparisonResultDto(
            "LINE_ITEM_MISMATCH",
            label,
            "Fail",
            "Medium",
            localLines.Count.ToString(CultureInfo.InvariantCulture),
            systemLines.Count.ToString(CultureInfo.InvariantCulture),
            "The local and system invoices contain a different number of line items.");
    }

    private IEnumerable<InvoiceComparisonResultDto> CompareLineItems(IReadOnlyList<InvoiceLineItemDto> localLines, IReadOnlyList<InvoiceLineItemDto> systemLines)
    {
        var maxCount = Math.Max(localLines.Count, systemLines.Count);
        for (var index = 0; index < maxCount; index++)
        {
            var localLine = index < localLines.Count ? localLines[index] : null;
            var systemLine = index < systemLines.Count ? systemLines[index] : null;
            var lineNumber = localLine?.LineNumber ?? systemLine?.LineNumber ?? index + 1;

            yield return CompareTextField("LINE_ITEM_MISMATCH", $"Line {lineNumber} description", localLine?.Description, systemLine?.Description, "Medium");
            yield return CompareDecimalField("LINE_ITEM_MISMATCH", $"Line {lineNumber} quantity", localLine?.Quantity, systemLine?.Quantity, 0.0001m, "Medium");
            yield return CompareDecimalField("LINE_ITEM_MISMATCH", $"Line {lineNumber} unit price", localLine?.UnitPrice, systemLine?.UnitPrice, options.AmountTolerance, "Medium");
            yield return CompareDecimalField("LINE_ITEM_MISMATCH", $"Line {lineNumber} amount", localLine?.Amount, systemLine?.Amount, options.AmountTolerance, "High");
            yield return CompareTextField("LINE_ITEM_MISMATCH", $"Line {lineNumber} coding", localLine?.Coding, systemLine?.Coding, "Low");
        }
    }

    private InvoiceComparisonResultDto CompareTextField(string ruleCode, string label, string? localValue, string? systemValue, string severity)
    {
        if (string.IsNullOrWhiteSpace(localValue) && string.IsNullOrWhiteSpace(systemValue))
        {
            return new InvoiceComparisonResultDto(ruleCode, label, "Not Available", severity, null, null, "No value was available on either side.");
        }

        if (string.IsNullOrWhiteSpace(systemValue))
        {
            return new InvoiceComparisonResultDto(ruleCode, label, "Not Available", severity, localValue, null, "The system invoice does not provide a value for this field.");
        }

        if (string.IsNullOrWhiteSpace(localValue))
        {
            return new InvoiceComparisonResultDto(ruleCode, label, "Warning", severity, null, systemValue, "The local invoice does not provide a value for this field.");
        }

        if (EqualsNormalized(localValue, systemValue))
        {
            return new InvoiceComparisonResultDto(ruleCode, label, "Pass", severity, localValue, systemValue, "The values match.");
        }

        return new InvoiceComparisonResultDto(ruleCode, label, "Fail", severity, localValue, systemValue, "The local invoice value does not match the system invoice value.");
    }

    private InvoiceComparisonResultDto CompareAmountField(string ruleCode, string label, decimal? localValue, decimal? systemValue, string severity)
    {
        return CompareDecimalField(ruleCode, label, localValue, systemValue, options.AmountTolerance, severity);
    }

    private InvoiceComparisonResultDto CompareDecimalField(string ruleCode, string label, decimal? localValue, decimal? systemValue, decimal tolerance, string severity)
    {
        if (!localValue.HasValue && !systemValue.HasValue)
        {
            return new InvoiceComparisonResultDto(ruleCode, label, "Not Available", severity, null, null, "No value was available on either side.");
        }

        if (!systemValue.HasValue)
        {
            return new InvoiceComparisonResultDto(ruleCode, label, "Not Available", severity, localValue?.ToString(CultureInfo.InvariantCulture), null, "The system invoice does not provide a value for this field.");
        }

        if (!localValue.HasValue)
        {
            return new InvoiceComparisonResultDto(ruleCode, label, "Warning", severity, null, systemValue.Value.ToString(CultureInfo.InvariantCulture), "The local invoice does not provide a value for this field.");
        }

        var difference = Math.Abs(localValue.Value - systemValue.Value);
        if (difference <= tolerance)
        {
            return new InvoiceComparisonResultDto(ruleCode, label, "Pass", severity, localValue.Value.ToString(CultureInfo.InvariantCulture), systemValue.Value.ToString(CultureInfo.InvariantCulture), "The values match within tolerance.");
        }

        return new InvoiceComparisonResultDto(ruleCode, label, "Fail", severity, localValue.Value.ToString(CultureInfo.InvariantCulture), systemValue.Value.ToString(CultureInfo.InvariantCulture), "The local invoice value does not match the system invoice value.");
    }

    private InvoiceComparisonResultDto CompareDateField(string ruleCode, string label, DateTimeOffset? localValue, DateTimeOffset? systemValue, string severity)
    {
        if (!localValue.HasValue && !systemValue.HasValue)
        {
            return new InvoiceComparisonResultDto(ruleCode, label, "Not Available", severity, null, null, "No value was available on either side.");
        }

        if (!systemValue.HasValue)
        {
            return new InvoiceComparisonResultDto(ruleCode, label, "Not Available", severity, localValue?.ToString("O"), null, "The system invoice does not provide a value for this field.");
        }

        if (!localValue.HasValue)
        {
            return new InvoiceComparisonResultDto(ruleCode, label, "Warning", severity, null, systemValue.Value.ToString("O"), "The local invoice does not provide a value for this field.");
        }

        var difference = Math.Abs((localValue.Value.UtcDateTime.Date - systemValue.Value.UtcDateTime.Date).TotalDays);
        if (difference <= options.DateToleranceDays)
        {
            return new InvoiceComparisonResultDto(ruleCode, label, "Pass", severity, localValue.Value.ToString("O"), systemValue.Value.ToString("O"), "The dates match within tolerance.");
        }

        return new InvoiceComparisonResultDto(ruleCode, label, "Fail", severity, localValue.Value.ToString("O"), systemValue.Value.ToString("O"), "The local invoice date does not match the system invoice date.");
    }

    private static bool EqualsNormalized(string? left, string? right)
    {
        return string.Equals(left?.Trim(), right?.Trim(), StringComparison.OrdinalIgnoreCase);
    }

    private static string SummarizeOverallStatus(IReadOnlyList<InvoiceComparisonResultDto> results)
    {
        if (results.Any(result => result.Status.Equals("Fail", StringComparison.OrdinalIgnoreCase)))
        {
            return "Fail";
        }

        if (results.Any(result => result.Status.Equals("Warning", StringComparison.OrdinalIgnoreCase)))
        {
            return "Warning";
        }

        return results.Any() ? "Pass" : "Not Available";
    }

    private static NormalizedInvoice MapLocalInvoice(LocalInvoiceMetadataSnapshot snapshot)
    {
        var metadata = snapshot.Metadata;
        return new NormalizedInvoice(
            null,
            metadata.InvoiceNumber,
            metadata.SupplierNumber,
            metadata.SupplierName,
            TryParseDate(metadata.InvoiceDate),
            metadata.PurchaseOrderNumber,
            metadata.AfeNumber,
            metadata.CostCenter,
            metadata.Currency,
            metadata.Subtotal,
            metadata.Tax,
            metadata.TotalAmount,
            metadata.Status,
            metadata.ExportStatus,
            metadata.PaymentStatus,
            metadata.LineItems.Select(line => new InvoiceLineItemDto(line.LineNumber, line.Description, line.Quantity, line.UnitPrice, line.Amount, line.Coding)).ToArray());
    }

    private static DateTimeOffset? TryParseDate(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private static string NormalizeExportStatus(string status)
    {
        return status.ToLowerInvariant() switch
        {
            "approved" => "Exported",
            "sentback" => "Not Exported",
            _ => "Pending"
        };
    }

    private static string NormalizePaymentStatus(string status)
    {
        return status.ToLowerInvariant() switch
        {
            "approved" => "Pending Payment",
            "sentback" => "On Hold",
            _ => "Awaiting Approval"
        };
    }

    private sealed record LocalInvoiceFileRecord(
        int LocalInvoiceFileId,
        string FileName,
        string FilePath,
        string MetadataPath,
        string? InvoiceNumber,
        string? SupplierNumber,
        string? SupplierName,
        decimal? TotalAmount,
        DateTimeOffset LoadedAtUtc);

    private sealed record MatchCandidate(
        NormalizedInvoice? SystemInvoice,
        string MatchStatus,
        decimal? MatchScore);
}
