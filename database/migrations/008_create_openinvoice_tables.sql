CREATE TABLE dbo.OpenInvoiceSyncRuns (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    Environment NVARCHAR(50) NOT NULL,
    JobName NVARCHAR(100) NOT NULL,
    StartedAtUtc DATETIME2 NOT NULL,
    CompletedAtUtc DATETIME2 NULL,
    Status NVARCHAR(30) NOT NULL,
    RecordsRequested INT NOT NULL DEFAULT 0,
    RecordsImported INT NOT NULL DEFAULT 0,
    RecordsFailed INT NOT NULL DEFAULT 0,
    ErrorMessage NVARCHAR(MAX) NULL
);

CREATE TABLE dbo.OpenInvoiceSyncCursors (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    Environment NVARCHAR(50) NOT NULL,
    ServiceType NVARCHAR(100) NOT NULL,
    LastSuccessfulSyncUtc DATETIME2 NOT NULL,
    LastResourceSetId NVARCHAR(120) NULL,
    UpdatedAtUtc DATETIME2 NOT NULL
);

CREATE UNIQUE INDEX IX_OpenInvoiceSyncCursors_Environment_ServiceType
    ON dbo.OpenInvoiceSyncCursors(Environment, ServiceType);

CREATE TABLE dbo.OpenInvoiceRawDocuments (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    OpenInvoiceDocumentId NVARCHAR(120) NOT NULL,
    DocumentType NVARCHAR(100) NOT NULL,
    SourceEndpoint NVARCHAR(500) NOT NULL,
    ContentType NVARCHAR(120) NOT NULL,
    ContentEncoding NVARCHAR(50) NULL,
    RawBody VARBINARY(MAX) NOT NULL,
    BodyHash NVARCHAR(128) NOT NULL,
    ReceivedAtUtc DATETIME2 NOT NULL
);

CREATE INDEX IX_OpenInvoiceRawDocuments_DocumentId_ReceivedAtUtc
    ON dbo.OpenInvoiceRawDocuments(OpenInvoiceDocumentId, ReceivedAtUtc DESC);

CREATE TABLE dbo.OpenInvoiceEventOutbox (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    OpenInvoiceDocumentId NVARCHAR(120) NULL,
    EventType NVARCHAR(120) NOT NULL,
    PayloadJson NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    AttemptCount INT NOT NULL DEFAULT 0,
    LastAttemptAtUtc DATETIME2 NULL,
    LastError NVARCHAR(MAX) NULL,
    CreatedAtUtc DATETIME2 NOT NULL,
    CompletedAtUtc DATETIME2 NULL
);

CREATE INDEX IX_OpenInvoiceEventOutbox_Status_CreatedAtUtc
    ON dbo.OpenInvoiceEventOutbox(Status, CreatedAtUtc ASC);

CREATE TABLE dbo.InvoiceAttachments (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    InvoiceId UNIQUEIDENTIFIER NOT NULL,
    OpenInvoiceAttachmentId NVARCHAR(120) NOT NULL,
    FileName NVARCHAR(260) NOT NULL,
    ContentType NVARCHAR(120) NOT NULL,
    SizeBytes BIGINT NOT NULL,
    StoragePath NVARCHAR(500) NOT NULL,
    BodyHash NVARCHAR(128) NOT NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_InvoiceAttachments_Invoice FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoice(InvoiceId) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IX_InvoiceAttachments_OpenInvoiceAttachmentId
    ON dbo.InvoiceAttachments(OpenInvoiceAttachmentId);

CREATE INDEX IX_InvoiceAttachments_InvoiceId
    ON dbo.InvoiceAttachments(InvoiceId);

CREATE TABLE dbo.InvoiceSnapshots (
    Id UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    InvoiceId UNIQUEIDENTIFIER NOT NULL,
    StoragePath NVARCHAR(500) NOT NULL,
    ContentType NVARCHAR(120) NOT NULL,
    SizeBytes BIGINT NOT NULL,
    BodyHash NVARCHAR(128) NOT NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_InvoiceSnapshots_Invoice FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoice(InvoiceId) ON DELETE CASCADE
);

CREATE INDEX IX_InvoiceSnapshots_InvoiceId
    ON dbo.InvoiceSnapshots(InvoiceId);

IF COL_LENGTH('dbo.Invoice', 'OpenInvoiceDocumentId') IS NULL
BEGIN
    ALTER TABLE dbo.Invoice
    ADD OpenInvoiceDocumentId NVARCHAR(120) NULL;

    CREATE INDEX IX_Invoice_OpenInvoiceDocumentId
        ON dbo.Invoice(OpenInvoiceDocumentId);
END
