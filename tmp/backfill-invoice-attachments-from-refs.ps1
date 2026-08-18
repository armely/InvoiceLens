$ErrorActionPreference = 'Stop'
Set-Location 'c:\Users\lmwangi\Desktop\InvoiceLens'

$envMap = @{}
Get-Content '.env' | ForEach-Object {
  $line = $_.Trim()
  if (-not $line -or $line.StartsWith('#')) { return }
  $idx = $line.IndexOf('=')
  if ($idx -lt 1) { return }
  $envMap[$line.Substring(0, $idx)] = $line.Substring($idx + 1)
}

$sqlcmd = 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
$server = $envMap['InvoiceLens__Sql__ServerHost']
$db = $envMap['InvoiceLens__Sql__DatabaseName']
$user = $envMap['InvoiceLens__Sql__Username']
$pass = $envMap['InvoiceLens__Sql__Password']

$query = @"
;WITH Missing AS (
    SELECT
        NEWID() AS Id,
        r.InvoiceId,
        r.ExternalAttachmentId,
        r.FileName,
        r.ContentType,
        CAST(0 AS BIGINT) AS SizeBytes,
        CONCAT('legacy://', r.ExternalAttachmentId) AS StoragePath,
        CONVERT(VARCHAR(128), HASHBYTES('SHA2_256', CONVERT(VARBINARY(MAX), r.ExternalAttachmentId)), 2) AS BodyHash,
        r.CreatedAtUtc
    FROM dbo.InvoiceAttachmentReference r
    WHERE NOT EXISTS (
        SELECT 1
        FROM dbo.InvoiceAttachments a
        WHERE a.InvoiceId = r.InvoiceId
          AND a.OpenInvoiceAttachmentId = r.ExternalAttachmentId
    )
)
INSERT INTO dbo.InvoiceAttachments
    (Id, InvoiceId, OpenInvoiceAttachmentId, FileName, ContentType, SizeBytes, StoragePath, BodyHash, CreatedAtUtc)
SELECT
    Id, InvoiceId, ExternalAttachmentId, FileName, ContentType, SizeBytes, StoragePath, BodyHash, CreatedAtUtc
FROM Missing;

SELECT @@ROWCOUNT AS InsertedRows;

SELECT
    (SELECT COUNT(1) FROM dbo.InvoiceAttachmentReference) AS LegacyReferenceCount,
    (SELECT COUNT(1) FROM dbo.InvoiceAttachments) AS InvoiceAttachmentsCount;
"@

& $sqlcmd -S $server -U $user -P $pass -d $db -N -C -W -s '|' -b -Q $query
