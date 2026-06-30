CREATE TABLE dbo.AuditEntry (
    AuditEntryId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    InvoiceId UNIQUEIDENTIFIER NOT NULL,
    ActionType NVARCHAR(40) NOT NULL,
    PerformedBy NVARCHAR(120) NOT NULL,
    Details NVARCHAR(1000) NOT NULL,
    OccurredAtUtc DATETIME2 NOT NULL,
    CONSTRAINT FK_AuditEntry_Invoice FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoice(InvoiceId)
);

CREATE INDEX IX_AuditEntry_InvoiceId_OccurredAtUtc ON dbo.AuditEntry(InvoiceId, OccurredAtUtc DESC);
