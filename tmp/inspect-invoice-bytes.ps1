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

& $sqlcmd -S $server -U $user -P $pass -d $db -N -C -W -s '|' -b -Q @"
SELECT TOP 3
  OpenInvoiceDocumentId,
  ContentType,
  DATALENGTH(RawBody) AS RawBytes,
  CONVERT(VARCHAR(200), SUBSTRING(RawBody,1,64), 1) AS HeadHex
FROM dbo.OpenInvoiceRawDocuments
WHERE DocumentType='invoice'
ORDER BY ReceivedAtUtc DESC;
"@
