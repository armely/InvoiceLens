SELECT
    i.Status,
    COUNT(*) AS InvoiceCount,
    SUM(i.TotalAmount) AS TotalAmount
FROM dbo.Invoice i
GROUP BY i.Status
ORDER BY i.Status;

SELECT
    COUNT(*) AS ErrorCount,
    MAX(OccurredAtUtc) AS LastErrorUtc
FROM dbo.SyncError;
