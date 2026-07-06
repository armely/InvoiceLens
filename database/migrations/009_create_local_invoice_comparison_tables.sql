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

    CREATE UNIQUE INDEX UX_LocalInvoiceFiles_FileName ON dbo.LocalInvoiceFiles(FileName);
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

    CREATE INDEX IX_InvoiceComparisonRuns_LocalInvoiceFileId_CreatedAtUtc ON dbo.InvoiceComparisonRuns(LocalInvoiceFileId, CreatedAtUtc DESC);
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

    CREATE INDEX IX_InvoiceComparisonResults_ComparisonRunId ON dbo.InvoiceComparisonResults(ComparisonRunId);
END;
