IF OBJECT_ID('dbo.Invoice', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Invoice (
        InvoiceId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        InvoiceNumber NVARCHAR(50) NOT NULL,
        VendorCode NVARCHAR(100) NOT NULL,
        CompanyCode NVARCHAR(50) NOT NULL,
        AfeCode NVARCHAR(50) NULL,
        TotalAmount DECIMAL(18,2) NOT NULL,
        CurrencyCode NVARCHAR(10) NOT NULL,
        Status NVARCHAR(30) NOT NULL,
        UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID('dbo.InvoiceLine', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InvoiceLine (
        InvoiceLineId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        InvoiceId UNIQUEIDENTIFIER NOT NULL,
        LineNumber INT NOT NULL,
        Description NVARCHAR(500) NULL,
        Quantity DECIMAL(18,4) NOT NULL,
        UnitPrice DECIMAL(18,4) NOT NULL,
        Amount DECIMAL(18,2) NOT NULL,
        CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_InvoiceLine_Invoice FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoice(InvoiceId) ON DELETE CASCADE
    );
END;

IF OBJECT_ID('dbo.InvoiceAttachmentReference', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InvoiceAttachmentReference (
        AttachmentId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        InvoiceId UNIQUEIDENTIFIER NOT NULL,
        ExternalAttachmentId NVARCHAR(120) NOT NULL,
        FileName NVARCHAR(260) NOT NULL,
        ContentType NVARCHAR(120) NOT NULL,
        CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_InvoiceAttachmentReference_Invoice FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoice(InvoiceId) ON DELETE CASCADE
    );
END;

IF OBJECT_ID('dbo.SyncCheckpoint', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SyncCheckpoint (
        SyncCheckpointId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SyncType NVARCHAR(50) NOT NULL,
        LastRunUtc DATETIME2 NOT NULL,
        LastCursor NVARCHAR(250) NULL,
        CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID('dbo.SyncBatch', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SyncBatch (
        SyncBatchId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SyncType NVARCHAR(50) NOT NULL,
        StartedAtUtc DATETIME2 NOT NULL,
        FinishedAtUtc DATETIME2 NULL,
        ProcessedCount INT NOT NULL,
        FailedCount INT NOT NULL,
        Status NVARCHAR(30) NOT NULL
    );
END;

IF OBJECT_ID('dbo.SyncError', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SyncError (
        SyncErrorId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        SyncBatchId UNIQUEIDENTIFIER NOT NULL,
        InvoiceExternalId NVARCHAR(120) NULL,
        ErrorCode NVARCHAR(100) NULL,
        ErrorMessage NVARCHAR(MAX) NOT NULL,
        OccurredAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        RetryCount INT NOT NULL DEFAULT 0,
        CONSTRAINT FK_SyncError_SyncBatch FOREIGN KEY (SyncBatchId) REFERENCES dbo.SyncBatch(SyncBatchId) ON DELETE CASCADE
    );
END;

IF OBJECT_ID('dbo.ValidationRule', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ValidationRule (
        ValidationRuleId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        RuleName NVARCHAR(120) NOT NULL,
        Severity NVARCHAR(20) NOT NULL,
        Description NVARCHAR(500) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc DATETIME2 NULL
    );
END;

IF OBJECT_ID('dbo.ValidationResult', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ValidationResult (
        ValidationResultId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        InvoiceId UNIQUEIDENTIFIER NOT NULL,
        RuleName NVARCHAR(120) NOT NULL,
        Status NVARCHAR(20) NOT NULL,
        Severity NVARCHAR(20) NOT NULL,
        Message NVARCHAR(500) NOT NULL,
        ExecutedAtUtc DATETIME2 NOT NULL,
        CONSTRAINT FK_ValidationResult_Invoice FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoice(InvoiceId) ON DELETE CASCADE
    );
END;

IF OBJECT_ID('dbo.AuditEntry', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AuditEntry (
        AuditEntryId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        InvoiceId UNIQUEIDENTIFIER NOT NULL,
        ActionType NVARCHAR(40) NOT NULL,
        PerformedBy NVARCHAR(120) NOT NULL,
        Details NVARCHAR(1000) NOT NULL,
        OccurredAtUtc DATETIME2 NOT NULL,
        CONSTRAINT FK_AuditEntry_Invoice FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoice(InvoiceId) ON DELETE CASCADE
    );
END;

IF OBJECT_ID('dbo.MsaContract', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.MsaContract (
        ContractId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        Vendor NVARCHAR(150) NOT NULL,
        MaxRate DECIMAL(18,2) NOT NULL,
        Currency NVARCHAR(10) NOT NULL,
        EffectiveFrom DATE NOT NULL,
        EffectiveTo DATE NULL,
        CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAtUtc DATETIME2 NULL
    );
END;

IF OBJECT_ID('dbo.LocalInvoiceFiles', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.LocalInvoiceFiles (
        LocalInvoiceFileId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        FileName NVARCHAR(255) NOT NULL,
        FilePath NVARCHAR(1000) NOT NULL,
        MetadataPath NVARCHAR(1000) NULL,
        InvoiceNumber NVARCHAR(100) NULL,
        SupplierNumber NVARCHAR(100) NULL,
        SupplierName NVARCHAR(255) NULL,
        TotalAmount DECIMAL(18,2) NULL,
        LoadedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;

IF OBJECT_ID('dbo.InvoiceComparisonRuns', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InvoiceComparisonRuns (
        ComparisonRunId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        LocalInvoiceFileId INT NOT NULL,
        SystemInvoiceId UNIQUEIDENTIFIER NULL,
        MatchStatus NVARCHAR(50) NOT NULL,
        OverallStatus NVARCHAR(50) NOT NULL,
        MatchScore DECIMAL(5,2) NULL,
        CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_InvoiceComparisonRuns_LocalInvoiceFiles FOREIGN KEY (LocalInvoiceFileId) REFERENCES dbo.LocalInvoiceFiles(LocalInvoiceFileId) ON DELETE CASCADE,
        CONSTRAINT FK_InvoiceComparisonRuns_Invoice FOREIGN KEY (SystemInvoiceId) REFERENCES dbo.Invoice(InvoiceId) ON DELETE SET NULL
    );
END;

IF OBJECT_ID('dbo.InvoiceComparisonResults', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.InvoiceComparisonResults (
        ComparisonResultId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ComparisonRunId INT NOT NULL,
        RuleCode NVARCHAR(100) NOT NULL,
        Label NVARCHAR(255) NOT NULL,
        Status NVARCHAR(50) NOT NULL,
        Severity NVARCHAR(50) NOT NULL,
        LocalValue NVARCHAR(1000) NULL,
        SystemValue NVARCHAR(1000) NULL,
        Message NVARCHAR(2000) NULL,
        CONSTRAINT FK_InvoiceComparisonResults_ComparisonRuns FOREIGN KEY (ComparisonRunId) REFERENCES dbo.InvoiceComparisonRuns(ComparisonRunId) ON DELETE CASCADE
    );
END;

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
