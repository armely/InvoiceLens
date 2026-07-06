SET NOCOUNT ON;

IF EXISTS (SELECT 1 FROM dbo.Invoice)
    RETURN;

DECLARE @InvoiceSeed TABLE
(
    RowNum INT IDENTITY(1,1) NOT NULL,
    InvoiceId UNIQUEIDENTIFIER NOT NULL,
    InvoiceNumber NVARCHAR(50) NOT NULL,
    Vendor NVARCHAR(100) NOT NULL,
    Company NVARCHAR(50) NOT NULL,
    Afe NVARCHAR(50) NOT NULL,
    TotalAmount DECIMAL(18,2) NOT NULL,
    Currency NVARCHAR(10) NOT NULL,
    Status NVARCHAR(30) NOT NULL
);

INSERT INTO @InvoiceSeed (InvoiceId, InvoiceNumber, Vendor, Company, Afe, TotalAmount, Currency, Status)
VALUES
    (NEWID(), 'INV-260701-0001', 'BluePeak Services LLC', 'North Ops', 'AFE-1001', 125430.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0002', 'NorthWind Drilling', 'South Ops', 'AFE-1002', 98750.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0003', 'Summit Logistics', 'North Ops', 'AFE-1003', 32110.00, 'USD', 'SentBack'),
    (NEWID(), 'INV-260701-0004', 'Velocity Rentals', 'Field Ops', 'AFE-1004', 17890.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0005', 'Global Fuel Supply', 'Fuel Ops', 'AFE-1005', 63540.00, 'USD', 'Approved'),
    (NEWID(), 'INV-260701-0006', 'Prairie Equipment', 'Logistics', 'AFE-1006', 12450.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0007', 'Atlas Hauling', 'Transport', 'AFE-1007', 45220.00, 'USD', 'SentBack'),
    (NEWID(), 'INV-260701-0008', 'Sunline Chemicals', 'North Ops', 'AFE-1008', 29210.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0009', 'Peak Field Services', 'Field Ops', 'AFE-1009', 75880.00, 'USD', 'Approved'),
    (NEWID(), 'INV-260701-0010', 'Canyon Maintenance', 'Maintenance', 'AFE-1010', 14320.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0011', 'IronGate Supply', 'Procurement', 'AFE-1011', 86400.00, 'USD', 'SentBack'),
    (NEWID(), 'INV-260701-0012', 'Driftwood Energy', 'Energy', 'AFE-1012', 55110.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0013', 'LoneStar Rentals', 'Field Ops', 'AFE-1013', 21440.00, 'USD', 'Approved'),
    (NEWID(), 'INV-260701-0014', 'Harbor Transport', 'Logistics', 'AFE-1014', 38760.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0015', 'Summit Production', 'North Ops', 'AFE-1015', 90320.00, 'USD', 'SentBack'),
    (NEWID(), 'INV-260701-0016', 'NorthStar Water', 'Services', 'AFE-1016', 16780.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0017', 'RedRock Fabrication', 'Maintenance', 'AFE-1017', 74250.00, 'USD', 'Approved'),
    (NEWID(), 'INV-260701-0018', 'Falcon Safety', 'Compliance', 'AFE-1018', 23690.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0019', 'Mesa Consulting', 'Corporate', 'AFE-1019', 41830.00, 'USD', 'SentBack'),
    (NEWID(), 'INV-260701-0020', 'Sierra Parts', 'Procurement', 'AFE-1020', 59870.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0021', 'High Plains Services', 'North Ops', 'AFE-1021', 27420.00, 'USD', 'Approved'),
    (NEWID(), 'INV-260701-0022', 'Iron Mesa Logistics', 'Logistics', 'AFE-1022', 48210.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0023', 'Coyote Energy', 'Energy', 'AFE-1023', 91350.00, 'USD', 'SentBack'),
    (NEWID(), 'INV-260701-0024', 'Canyon Ridge Supply', 'Field Ops', 'AFE-1024', 15640.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0025', 'Prairie Waterworks', 'Services', 'AFE-1025', 33480.00, 'USD', 'Approved'),
    (NEWID(), 'INV-260701-0026', 'Summit Telecom', 'Corporate', 'AFE-1026', 66990.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0027', 'Red River Rentals', 'Maintenance', 'AFE-1027', 41860.00, 'USD', 'SentBack'),
    (NEWID(), 'INV-260701-0028', 'Blue Mesa Analytics', 'Compliance', 'AFE-1028', 23740.00, 'USD', 'Approved'),
    (NEWID(), 'INV-260701-0029', 'Westwind Compliance', 'Procurement', 'AFE-1029', 58910.00, 'USD', 'PendingReview'),
    (NEWID(), 'INV-260701-0030', 'Frontier Industrial', 'Field Ops', 'AFE-1030', 72400.00, 'USD', 'Approved');

DECLARE @ValidationRuleSeed TABLE
(
    RuleName NVARCHAR(120) NOT NULL,
    Severity NVARCHAR(20) NOT NULL,
    Description NVARCHAR(500) NOT NULL
);

INSERT INTO @ValidationRuleSeed (RuleName, Severity, Description)
VALUES
    ('Vendor match', 'Info', 'Vendor matches the approved master record.'),
    ('AFE match', 'Medium', 'AFE code should be present and active.'),
    ('Cost center', 'Medium', 'Cost center mapping requires confirmation.'),
    ('Currency', 'Info', 'Currency aligns with operational policy.'),
    ('Amount variance', 'Medium', 'Amount should stay within tolerance.'),
    ('MSA rate', 'High', 'Invoice amount must stay within the contract cap.'),
    ('Duplicate invoice', 'High', 'Invoice number must be unique across the ledger.'),
    ('PO match', 'Medium', 'Purchase order should be present when required.'),
    ('Attachment present', 'Info', 'Invoice should include a supporting document.'),
    ('Approval chain', 'Medium', 'Approver chain should be complete before release.'),
    ('GL code', 'Medium', 'GL code should map to the correct cost center.'),
    ('Tax code', 'Medium', 'Tax code should be reviewed for compliance.'),
    ('Banking detail', 'High', 'Vendor banking details should be verified.'),
    ('Payment terms', 'Info', 'Payment terms should match the approved agreement.'),
    ('Region code', 'Info', 'Region code should be valid for the invoice.'),
    ('Contract term', 'High', 'Contract term should not be expired.'),
    ('Split invoice', 'Medium', 'Large invoices may require split review.'),
    ('Tolerance check', 'Info', 'Tolerance thresholds should be respected.'),
    ('Audit completeness', 'Info', 'Audit trail should record the review action.'),
    ('Exception routing', 'Medium', 'Exception routing should assign the right queue.');

DECLARE @BatchSeed TABLE
(
    RowNum INT IDENTITY(1,1) NOT NULL,
    SyncBatchId UNIQUEIDENTIFIER NOT NULL,
    SyncType NVARCHAR(50) NOT NULL,
    StartedAtUtc DATETIME2 NOT NULL,
    FinishedAtUtc DATETIME2 NULL,
    ProcessedCount INT NOT NULL,
    FailedCount INT NOT NULL,
    Status NVARCHAR(30) NOT NULL
);

INSERT INTO @BatchSeed (SyncBatchId, SyncType, StartedAtUtc, FinishedAtUtc, ProcessedCount, FailedCount, Status)
SELECT
    NEWID(),
    'OpenInvoice',
    DATEADD(hour, -i.RowNum, SYSUTCDATETIME()),
    DATEADD(hour, -i.RowNum, SYSUTCDATETIME()),
    1,
    CASE WHEN i.RowNum % 4 = 0 THEN 1 ELSE 0 END,
    CASE WHEN i.RowNum % 4 = 0 THEN 'Failed' ELSE 'Completed' END
FROM @InvoiceSeed AS i;

INSERT INTO dbo.Invoice
    (InvoiceId, InvoiceNumber, VendorCode, CompanyCode, AfeCode, TotalAmount, CurrencyCode, Status, UpdatedAtUtc, CreatedAtUtc)
SELECT
    InvoiceId,
    InvoiceNumber,
    Vendor,
    Company,
    Afe,
    TotalAmount,
    Currency,
    Status,
    DATEADD(minute, -5 * RowNum, SYSUTCDATETIME()),
    DATEADD(minute, -5 * RowNum, SYSUTCDATETIME())
FROM @InvoiceSeed;

INSERT INTO dbo.InvoiceLine
    (InvoiceLineId, InvoiceId, LineNumber, Description, Quantity, UnitPrice, Amount, CreatedAtUtc)
SELECT
    NEWID(),
    InvoiceId,
    1,
    CONCAT(Vendor, ' service line'),
    1.0000,
    TotalAmount,
    TotalAmount,
    DATEADD(minute, -5 * RowNum, SYSUTCDATETIME())
FROM @InvoiceSeed;

INSERT INTO dbo.InvoiceAttachmentReference
    (AttachmentId, InvoiceId, ExternalAttachmentId, FileName, ContentType, CreatedAtUtc)
SELECT
    NEWID(),
    InvoiceId,
    CONCAT('ATT-', InvoiceNumber),
    CONCAT(InvoiceNumber, '.pdf'),
    'application/pdf',
    DATEADD(minute, -5 * RowNum, SYSUTCDATETIME())
FROM @InvoiceSeed;

INSERT INTO dbo.ValidationRule
    (ValidationRuleId, RuleName, Severity, Description, IsActive, CreatedAtUtc, UpdatedAtUtc)
SELECT
    NEWID(),
    RuleName,
    Severity,
    Description,
    1,
    SYSUTCDATETIME(),
    NULL
FROM @ValidationRuleSeed;

INSERT INTO dbo.ValidationResult
    (ValidationResultId, InvoiceId, RuleName, Status, Severity, Message, ExecutedAtUtc)
SELECT
    NEWID(),
    i.InvoiceId,
    CASE i.RowNum
        WHEN 1 THEN 'Vendor match'
        WHEN 2 THEN 'AFE match'
        WHEN 3 THEN 'Cost center'
        WHEN 4 THEN 'Currency'
        WHEN 5 THEN 'Amount variance'
        WHEN 6 THEN 'MSA rate'
        WHEN 7 THEN 'Duplicate invoice'
        WHEN 8 THEN 'PO match'
        WHEN 9 THEN 'Attachment present'
        WHEN 10 THEN 'Approval chain'
        WHEN 11 THEN 'GL code'
        WHEN 12 THEN 'Tax code'
        WHEN 13 THEN 'Banking detail'
        WHEN 14 THEN 'Payment terms'
        WHEN 15 THEN 'Region code'
        WHEN 16 THEN 'Contract term'
        WHEN 17 THEN 'Split invoice'
        WHEN 18 THEN 'Tolerance check'
        WHEN 19 THEN 'Audit completeness'
        ELSE 'Exception routing'
    END,
    CASE
        WHEN i.RowNum IN (6, 13, 16) THEN 'Fail'
        WHEN i.RowNum IN (2, 3, 5, 7, 10, 12, 15, 17, 20) THEN 'Warning'
        ELSE 'Pass'
    END,
    CASE
        WHEN i.RowNum IN (6, 13, 16) THEN 'High'
        WHEN i.RowNum IN (2, 3, 5, 7, 10, 12, 15, 17, 20) THEN 'Medium'
        ELSE 'Info'
    END,
    CASE
        WHEN i.RowNum = 1 THEN 'Vendor aligned to master data.'
        WHEN i.RowNum = 2 THEN 'AFE code requires manual review.'
        WHEN i.RowNum = 3 THEN 'Cost center mapping is pending confirmation.'
        WHEN i.RowNum = 4 THEN 'Currency accepted without exception.'
        WHEN i.RowNum = 5 THEN 'Amount is within tolerance.'
        WHEN i.RowNum = 6 THEN 'Amount exceeds the contractual cap.'
        WHEN i.RowNum = 7 THEN 'Potential duplicate invoice detected.'
        WHEN i.RowNum = 8 THEN 'Purchase order match is pending.'
        WHEN i.RowNum = 9 THEN 'Supporting attachment is present.'
        WHEN i.RowNum = 10 THEN 'Approval chain needs review.'
        WHEN i.RowNum = 11 THEN 'GL code mapping is valid.'
        WHEN i.RowNum = 12 THEN 'Tax code requires additional review.'
        WHEN i.RowNum = 13 THEN 'Banking detail mismatch detected.'
        WHEN i.RowNum = 14 THEN 'Payment terms are acceptable.'
        WHEN i.RowNum = 15 THEN 'Region code matches policy.'
        WHEN i.RowNum = 16 THEN 'Contract term appears expired.'
        WHEN i.RowNum = 17 THEN 'Split invoice check requires a decision.'
        WHEN i.RowNum = 18 THEN 'Tolerance thresholds were respected.'
        WHEN i.RowNum = 19 THEN 'Audit trail is complete.'
        ELSE 'Exception routed to the review queue.'
    END,
    DATEADD(minute, -3 * i.RowNum, SYSUTCDATETIME())
FROM @InvoiceSeed AS i;

INSERT INTO dbo.MsaContract
    (ContractId, Vendor, MaxRate, Currency, EffectiveFrom, EffectiveTo, CreatedAtUtc, UpdatedAtUtc)
SELECT
    NEWID(),
    Vendor,
    TotalAmount + 15000.00,
    Currency,
    DATEFROMPARTS(2025, 1, 1),
    NULL,
    SYSUTCDATETIME(),
    NULL
FROM @InvoiceSeed;

INSERT INTO dbo.AuditEntry
    (AuditEntryId, InvoiceId, ActionType, PerformedBy, Details, OccurredAtUtc)
SELECT
    NEWID(),
    i.InvoiceId,
    CASE i.RowNum % 8
        WHEN 0 THEN 'ErpPushRequested'
        WHEN 1 THEN 'InvoiceViewed'
        WHEN 2 THEN 'ValidationExecuted'
        WHEN 3 THEN 'ExceptionDetected'
        WHEN 4 THEN 'Approved'
        WHEN 5 THEN 'SentBack'
        WHEN 6 THEN 'CommentAdded'
        ELSE 'DocumentDownloaded'
    END,
    CASE WHEN i.RowNum % 2 = 0 THEN 'analyst' ELSE 'system' END,
    CONCAT('Seeded audit event for ', i.InvoiceNumber),
    DATEADD(minute, -2 * i.RowNum, SYSUTCDATETIME())
FROM @InvoiceSeed AS i;

INSERT INTO dbo.SyncCheckpoint
    (SyncType, LastRunUtc, LastCursor, CreatedAtUtc)
SELECT
    'OpenInvoice',
    DATEADD(hour, -i.RowNum, SYSUTCDATETIME()),
    CONCAT('cursor-', RIGHT(CONCAT('00', CAST(i.RowNum AS nvarchar(10))), 2)),
    SYSUTCDATETIME()
FROM @InvoiceSeed AS i;

INSERT INTO dbo.SyncBatch
    (SyncBatchId, SyncType, StartedAtUtc, FinishedAtUtc, ProcessedCount, FailedCount, Status)
SELECT
    SyncBatchId,
    SyncType,
    StartedAtUtc,
    FinishedAtUtc,
    ProcessedCount,
    FailedCount,
    Status
FROM @BatchSeed;

INSERT INTO dbo.SyncError
    (SyncErrorId, SyncBatchId, InvoiceExternalId, ErrorCode, ErrorMessage, OccurredAtUtc, RetryCount)
SELECT
    NEWID(),
    b.SyncBatchId,
    CONCAT('EXT-', RIGHT(CONCAT('0000', CAST(i.RowNum AS nvarchar(10))), 4)),
    CASE WHEN i.RowNum % 4 = 0 THEN 'SYNC_TIMEOUT' ELSE 'SYNC_WARN' END,
    CONCAT('Seeded sync error for ', i.InvoiceNumber),
    DATEADD(minute, -i.RowNum, SYSUTCDATETIME()),
    0
FROM @InvoiceSeed AS i
INNER JOIN @BatchSeed AS b
    ON b.RowNum = i.RowNum;
