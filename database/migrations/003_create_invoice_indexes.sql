CREATE INDEX IX_Invoice_InvoiceNumber ON dbo.Invoice (InvoiceNumber);
CREATE INDEX IX_Invoice_VendorCode ON dbo.Invoice (VendorCode);
CREATE INDEX IX_Invoice_CompanyCode_AfeCode ON dbo.Invoice (CompanyCode, AfeCode);
CREATE INDEX IX_Invoice_Status_UpdatedAtUtc ON dbo.Invoice (Status, UpdatedAtUtc);
CREATE INDEX IX_InvoiceLine_InvoiceId ON dbo.InvoiceLine (InvoiceId);
CREATE INDEX IX_SyncError_OccurredAtUtc ON dbo.SyncError (OccurredAtUtc);
