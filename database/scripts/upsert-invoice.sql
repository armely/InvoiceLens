CREATE OR ALTER PROCEDURE dbo.UpsertInvoice
    @InvoiceId UNIQUEIDENTIFIER,
    @InvoiceNumber NVARCHAR(50),
    @VendorCode NVARCHAR(100),
    @CompanyCode NVARCHAR(50),
    @AfeCode NVARCHAR(50),
    @TotalAmount DECIMAL(18,2),
    @CurrencyCode NVARCHAR(10),
    @Status NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    MERGE dbo.Invoice AS target
    USING (SELECT @InvoiceId AS InvoiceId) AS source
    ON target.InvoiceId = source.InvoiceId
    WHEN MATCHED THEN
        UPDATE SET
            InvoiceNumber = @InvoiceNumber,
            VendorCode = @VendorCode,
            CompanyCode = @CompanyCode,
            AfeCode = @AfeCode,
            TotalAmount = @TotalAmount,
            CurrencyCode = @CurrencyCode,
            Status = @Status,
            UpdatedAtUtc = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (InvoiceId, InvoiceNumber, VendorCode, CompanyCode, AfeCode, TotalAmount, CurrencyCode, Status)
        VALUES (@InvoiceId, @InvoiceNumber, @VendorCode, @CompanyCode, @AfeCode, @TotalAmount, @CurrencyCode, @Status);
END;
