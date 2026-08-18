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

$out = 'tmp/openinvoice-sync-inspect.txt'
if (Test-Path $out) { Remove-Item $out -Force }

function Q([string]$title, [string]$query) {
  Add-Content -Path $out -Value "`n===== $title ====="
  & $sqlcmd -S $server -U $user -P $pass -d $db -N -C -W -s '|' -b -Q $query | Out-File -FilePath $out -Append -Encoding utf8
}

Q 'Raw Docs By Type' @"
SELECT DocumentType, COUNT(1) AS TotalRows, MAX(ReceivedAtUtc) AS LastReceived
FROM dbo.OpenInvoiceRawDocuments
GROUP BY DocumentType
ORDER BY DocumentType;
"@

Q 'Recent Raw Docs' @"
SELECT TOP 20 DocumentType, OpenInvoiceDocumentId, SourceEndpoint, ContentType, ContentEncoding, DATALENGTH(RawBody) AS RawBytes, ReceivedAtUtc
FROM dbo.OpenInvoiceRawDocuments
ORDER BY ReceivedAtUtc DESC;
"@

Q 'Invoices With OpenInvoiceDocumentId' @"
SELECT TOP 20 InvoiceNumber, VendorCode, OpenInvoiceDocumentId, UpdatedAtUtc
FROM dbo.Invoice
WHERE OpenInvoiceDocumentId IS NOT NULL
ORDER BY UpdatedAtUtc DESC;
"@

Q 'Most Recent Run Stats' @"
SELECT TOP 6 JobName, Status, RecordsRequested, RecordsImported, RecordsFailed, StartedAtUtc, CompletedAtUtc
FROM dbo.OpenInvoiceSyncRuns
ORDER BY StartedAtUtc DESC;
"@

Q 'Latest Invoice Payload Preview' @"
SELECT TOP 1
  OpenInvoiceDocumentId,
  ContentType,
  SUBSTRING(CAST(RawBody AS VARCHAR(MAX)), 1, 2400) AS PayloadPreview
FROM dbo.OpenInvoiceRawDocuments
WHERE DocumentType = 'invoice'
ORDER BY ReceivedAtUtc DESC;
"@

Get-Content $out
