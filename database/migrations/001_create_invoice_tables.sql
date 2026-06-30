CREATE TABLE dbo.Invoice (
    InvoiceId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    InvoiceNumber NVARCHAR(50) NOT NULL,
    VendorCode NVARCHAR(100) NOT NULL,
    CompanyCode NVARCHAR(50) NOT NULL,
    AfeCode NVARCHAR(50) NULL,
    TotalAmount DECIMAL(18,2) NOT NULL,
    CurrencyCode NVARCHAR(10) NOT NULL,
    Status NVARCHAR(30) NOT NULL,
    UpdatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.InvoiceLine (
    InvoiceLineId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    InvoiceId UNIQUEIDENTIFIER NOT NULL,
    LineNumber INT NOT NULL,
    Description NVARCHAR(500) NULL,
    Quantity DECIMAL(18,4) NOT NULL,
    UnitPrice DECIMAL(18,4) NOT NULL,
    Amount DECIMAL(18,2) NOT NULL,
    CONSTRAINT FK_InvoiceLine_Invoice FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoice(InvoiceId)
);

CREATE TABLE dbo.InvoiceAttachmentReference (
    AttachmentId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    InvoiceId UNIQUEIDENTIFIER NOT NULL,
    ExternalAttachmentId NVARCHAR(120) NOT NULL,
    FileName NVARCHAR(260) NOT NULL,
    ContentType NVARCHAR(120) NOT NULL,
    CONSTRAINT FK_InvoiceAttachmentReference_Invoice FOREIGN KEY (InvoiceId) REFERENCES dbo.Invoice(InvoiceId)
);
