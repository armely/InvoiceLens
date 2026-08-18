SET NOCOUNT ON;
SELECT i.InvoiceNumber, i.OpenInvoiceDocumentId, COUNT(ar.AttachmentId) AS AttachmentCount, STRING_AGG(ar.ExternalAttachmentId, ', ') AS AttachmentIds FROM dbo.Invoice i LEFT JOIN dbo.InvoiceAttachmentReference ar ON ar.InvoiceId = i.InvoiceId WHERE i.InvoiceNumber = 'INV-260701-0029' GROUP BY i.InvoiceNumber, i.OpenInvoiceDocumentId;
