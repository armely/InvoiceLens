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

$server = $envMap['InvoiceLens__Sql__ServerHost']
$db = $envMap['InvoiceLens__Sql__DatabaseName']
$user = $envMap['InvoiceLens__Sql__Username']
$pass = $envMap['InvoiceLens__Sql__Password']

$sqlcmd = 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'
if (-not (Test-Path $sqlcmd)) {
  throw "sqlcmd not found at $sqlcmd"
}

$outFile = 'tmp/attachment-sync-check.txt'
if (Test-Path $outFile) { Remove-Item $outFile -Force }

function Run-QueryToFile {
  param([string]$Title, [string]$Query)
  Add-Content -Path $outFile -Value "`n===== $Title ====="
  & $sqlcmd -S $server -U $user -P $pass -d $db -N -C -W -s '|' -b -Q $Query | Out-File -FilePath $outFile -Append -Encoding utf8
}

Run-QueryToFile -Title 'Connection Target' -Query "SELECT DB_NAME() AS DatabaseName, @@SERVERNAME AS ServerName;"
Run-QueryToFile -Title 'Table Counts' -Query @"
SELECT 'Invoice' AS TableName, COUNT(1) AS TotalRows FROM dbo.Invoice
UNION ALL SELECT 'InvoiceAttachmentReference', COUNT(1) FROM dbo.InvoiceAttachmentReference
UNION ALL SELECT 'InvoiceAttachments', COUNT(1) FROM dbo.InvoiceAttachments
UNION ALL SELECT 'OpenInvoiceRawDocuments', COUNT(1) FROM dbo.OpenInvoiceRawDocuments
UNION ALL SELECT 'OpenInvoiceSyncRuns', COUNT(1) FROM dbo.OpenInvoiceSyncRuns;
"@

Run-QueryToFile -Title 'Top Invoices By Attachments' -Query @"
SELECT TOP 15
  i.InvoiceNumber,
  i.VendorCode,
  SUM(CASE WHEN ar.AttachmentId IS NULL THEN 0 ELSE 1 END) AS LegacyAttachmentRefs,
  SUM(CASE WHEN ia.Id IS NULL THEN 0 ELSE 1 END) AS SyncedAttachments
FROM dbo.Invoice i
LEFT JOIN dbo.InvoiceAttachmentReference ar ON ar.InvoiceId = i.InvoiceId
LEFT JOIN dbo.InvoiceAttachments ia ON ia.InvoiceId = i.InvoiceId
GROUP BY i.InvoiceNumber, i.VendorCode
ORDER BY SyncedAttachments DESC, LegacyAttachmentRefs DESC, i.InvoiceNumber;
"@

Run-QueryToFile -Title 'Latest Sync Runs' -Query @"
SELECT TOP 12
  JobName,
  Status,
  StartedAtUtc,
  CompletedAtUtc,
  RecordsRequested,
  RecordsImported,
  RecordsFailed,
  LEFT(ISNULL(ErrorMessage, ''), 260) AS ErrorPreview
FROM dbo.OpenInvoiceSyncRuns
ORDER BY StartedAtUtc DESC;
"@

Get-Content $outFile
