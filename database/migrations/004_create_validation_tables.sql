CREATE TABLE dbo.ValidationResult (
    ValidationResultId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    InvoiceId UNIQUEIDENTIFIER NOT NULL,
    RuleName NVARCHAR(120) NOT NULL,
    Status NVARCHAR(20) NOT NULL,
    Severity NVARCHAR(20) NOT NULL,
    Message NVARCHAR(500) NOT NULL,
    ExecutedAtUtc DATETIME2 NOT NULL,
    CONSTRAINT FK_ValidationResult_Invoice FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoice(InvoiceId)
);
