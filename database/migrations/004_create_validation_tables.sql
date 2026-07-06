CREATE TABLE dbo.ValidationRule (
    ValidationRuleId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    RuleName NVARCHAR(120) NOT NULL,
    Severity NVARCHAR(20) NOT NULL,
    Description NVARCHAR(500) NOT NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAtUtc DATETIME2 NULL
);

CREATE UNIQUE INDEX UX_ValidationRule_RuleName ON dbo.ValidationRule(RuleName);

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

CREATE INDEX IX_ValidationResult_InvoiceId_ExecutedAtUtc ON dbo.ValidationResult(InvoiceId, ExecutedAtUtc DESC);
CREATE INDEX IX_ValidationResult_RuleName ON dbo.ValidationResult(RuleName);
