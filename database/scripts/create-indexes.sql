IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoice_InvoiceNumber' AND object_id = OBJECT_ID('dbo.Invoice'))
    CREATE INDEX IX_Invoice_InvoiceNumber ON dbo.Invoice (InvoiceNumber);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoice_VendorCode' AND object_id = OBJECT_ID('dbo.Invoice'))
    CREATE INDEX IX_Invoice_VendorCode ON dbo.Invoice (VendorCode);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoice_CompanyCode_AfeCode' AND object_id = OBJECT_ID('dbo.Invoice'))
    CREATE INDEX IX_Invoice_CompanyCode_AfeCode ON dbo.Invoice (CompanyCode, AfeCode);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoice_Status_UpdatedAtUtc' AND object_id = OBJECT_ID('dbo.Invoice'))
    CREATE INDEX IX_Invoice_Status_UpdatedAtUtc ON dbo.Invoice (Status, UpdatedAtUtc);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoice_UpdatedAtUtc_InvoiceNumber' AND object_id = OBJECT_ID('dbo.Invoice'))
    CREATE INDEX IX_Invoice_UpdatedAtUtc_InvoiceNumber
        ON dbo.Invoice (UpdatedAtUtc DESC, InvoiceNumber ASC)
        INCLUDE (InvoiceId, VendorCode, CompanyCode, AfeCode, TotalAmount, CurrencyCode, Status, CreatedAtUtc);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Invoice_PendingReviewQueue' AND object_id = OBJECT_ID('dbo.Invoice'))
    CREATE INDEX IX_Invoice_PendingReviewQueue
        ON dbo.Invoice (UpdatedAtUtc ASC, InvoiceNumber ASC)
        INCLUDE (InvoiceId, VendorCode, Status)
        WHERE Status IN ('PendingReview', 'SentBack');

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InvoiceLine_InvoiceId' AND object_id = OBJECT_ID('dbo.InvoiceLine'))
    CREATE INDEX IX_InvoiceLine_InvoiceId ON dbo.InvoiceLine (InvoiceId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InvoiceAttachmentReference_InvoiceId' AND object_id = OBJECT_ID('dbo.InvoiceAttachmentReference'))
    CREATE INDEX IX_InvoiceAttachmentReference_InvoiceId ON dbo.InvoiceAttachmentReference (InvoiceId);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SyncCheckpoint_SyncType' AND object_id = OBJECT_ID('dbo.SyncCheckpoint'))
    CREATE INDEX IX_SyncCheckpoint_SyncType ON dbo.SyncCheckpoint (SyncType);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SyncBatch_SyncType_Status' AND object_id = OBJECT_ID('dbo.SyncBatch'))
    CREATE INDEX IX_SyncBatch_SyncType_Status ON dbo.SyncBatch (SyncType, Status);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SyncError_OccurredAtUtc' AND object_id = OBJECT_ID('dbo.SyncError'))
    CREATE INDEX IX_SyncError_OccurredAtUtc ON dbo.SyncError (OccurredAtUtc);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_SyncError_SyncBatchId_OccurredAtUtc' AND object_id = OBJECT_ID('dbo.SyncError'))
    CREATE INDEX IX_SyncError_SyncBatchId_OccurredAtUtc ON dbo.SyncError (SyncBatchId, OccurredAtUtc DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_ValidationRule_RuleName' AND object_id = OBJECT_ID('dbo.ValidationRule'))
    CREATE UNIQUE INDEX UX_ValidationRule_RuleName ON dbo.ValidationRule(RuleName);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ValidationResult_InvoiceId_ExecutedAtUtc' AND object_id = OBJECT_ID('dbo.ValidationResult'))
    CREATE INDEX IX_ValidationResult_InvoiceId_ExecutedAtUtc ON dbo.ValidationResult(InvoiceId, ExecutedAtUtc DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ValidationResult_RuleName' AND object_id = OBJECT_ID('dbo.ValidationResult'))
    CREATE INDEX IX_ValidationResult_RuleName ON dbo.ValidationResult(RuleName);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditEntry_InvoiceId_OccurredAtUtc' AND object_id = OBJECT_ID('dbo.AuditEntry'))
    CREATE INDEX IX_AuditEntry_InvoiceId_OccurredAtUtc ON dbo.AuditEntry(InvoiceId, OccurredAtUtc DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MsaContract_Vendor' AND object_id = OBJECT_ID('dbo.MsaContract'))
    CREATE INDEX IX_MsaContract_Vendor ON dbo.MsaContract(Vendor);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_MsaContract_Vendor_EffectiveFrom' AND object_id = OBJECT_ID('dbo.MsaContract'))
    CREATE INDEX IX_MsaContract_Vendor_EffectiveFrom ON dbo.MsaContract(Vendor, EffectiveFrom DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_LocalInvoiceFiles_FileName' AND object_id = OBJECT_ID('dbo.LocalInvoiceFiles'))
    CREATE UNIQUE INDEX UX_LocalInvoiceFiles_FileName ON dbo.LocalInvoiceFiles(FileName);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InvoiceComparisonRuns_LocalInvoiceFileId_CreatedAtUtc' AND object_id = OBJECT_ID('dbo.InvoiceComparisonRuns'))
    CREATE INDEX IX_InvoiceComparisonRuns_LocalInvoiceFileId_CreatedAtUtc ON dbo.InvoiceComparisonRuns(LocalInvoiceFileId, CreatedAtUtc DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_InvoiceComparisonResults_ComparisonRunId' AND object_id = OBJECT_ID('dbo.InvoiceComparisonResults'))
    CREATE INDEX IX_InvoiceComparisonResults_ComparisonRunId ON dbo.InvoiceComparisonResults(ComparisonRunId);
