IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoice_UpdatedAtUtc_InvoiceNumber' AND object_id = OBJECT_ID('dbo.Invoice'))
    CREATE INDEX IX_Invoice_UpdatedAtUtc_InvoiceNumber
        ON dbo.Invoice (UpdatedAtUtc DESC, InvoiceNumber ASC)
        INCLUDE (InvoiceId, VendorCode, CompanyCode, AfeCode, TotalAmount, CurrencyCode, Status, CreatedAtUtc);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoice_PendingReviewQueue' AND object_id = OBJECT_ID('dbo.Invoice'))
    CREATE INDEX IX_Invoice_PendingReviewQueue
        ON dbo.Invoice (UpdatedAtUtc ASC, InvoiceNumber ASC)
        INCLUDE (InvoiceId, VendorCode, Status)
        WHERE Status IN ('PendingReview', 'SentBack');
