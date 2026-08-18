IF COL_LENGTH('dbo.InvoiceAttachmentReference', 'DocumentUrl') IS NULL
BEGIN
    ALTER TABLE dbo.InvoiceAttachmentReference
        ADD DocumentUrl NVARCHAR(500) NULL;
END;
GO

IF COL_LENGTH('dbo.InvoiceAttachments', 'DocumentUrl') IS NULL
BEGIN
    ALTER TABLE dbo.InvoiceAttachments
        ADD DocumentUrl NVARCHAR(500) NULL;
END;
GO

IF COL_LENGTH('dbo.InvoiceSnapshots', 'DocumentUrl') IS NULL
BEGIN
    ALTER TABLE dbo.InvoiceSnapshots
        ADD DocumentUrl NVARCHAR(500) NULL;
END;
GO

UPDATE dbo.InvoiceAttachmentReference
SET DocumentUrl = CONCAT('/api/invoices/', CONVERT(NVARCHAR(36), InvoiceId), '/attachments/', ExternalAttachmentId)
WHERE DocumentUrl IS NULL OR DocumentUrl = '';
GO

UPDATE dbo.InvoiceAttachments
SET DocumentUrl = CONCAT('/api/invoices/', CONVERT(NVARCHAR(36), InvoiceId), '/attachments/', OpenInvoiceAttachmentId)
WHERE DocumentUrl IS NULL OR DocumentUrl = '';
GO

UPDATE dbo.InvoiceSnapshots
SET DocumentUrl = CONCAT('/api/invoices/', CONVERT(NVARCHAR(36), InvoiceId), '/snapshot')
WHERE DocumentUrl IS NULL OR DocumentUrl = '';
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.InvoiceAttachmentReference')
      AND name = 'DocumentUrl'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.InvoiceAttachmentReference
        ALTER COLUMN DocumentUrl NVARCHAR(500) NOT NULL;
END;
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.InvoiceAttachments')
      AND name = 'DocumentUrl'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.InvoiceAttachments
        ALTER COLUMN DocumentUrl NVARCHAR(500) NOT NULL;
END;
GO

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.InvoiceSnapshots')
      AND name = 'DocumentUrl'
      AND is_nullable = 1
)
BEGIN
    ALTER TABLE dbo.InvoiceSnapshots
        ALTER COLUMN DocumentUrl NVARCHAR(500) NOT NULL;
END;
GO
