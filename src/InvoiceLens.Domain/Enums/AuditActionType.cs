namespace InvoiceLens.Domain.Enums;

public enum AuditActionType
{
    InvoiceViewed = 0,
    ValidationExecuted = 1,
    ExceptionDetected = 2,
    Approved = 3,
    SentBack = 4,
    CommentAdded = 5,
    DocumentDownloaded = 6,
    ErpPushRequested = 7
}
