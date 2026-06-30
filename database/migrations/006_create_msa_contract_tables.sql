CREATE TABLE dbo.MsaContract (
    ContractId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
    Vendor NVARCHAR(150) NOT NULL,
    MaxRate DECIMAL(18,2) NOT NULL,
    Currency NVARCHAR(10) NOT NULL,
    EffectiveFrom DATE NOT NULL,
    EffectiveTo DATE NULL
);

CREATE INDEX IX_MsaContract_Vendor ON dbo.MsaContract(Vendor);
