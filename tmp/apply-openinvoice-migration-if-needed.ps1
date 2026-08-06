$ErrorActionPreference = 'Stop'
Set-Location 'c:\Users\lmwangi\Desktop\InvoiceLens'

$envFile = '.env'
$map = @{}
Get-Content $envFile | ForEach-Object {
  $l = $_.Trim()
  if (-not $l -or $l.StartsWith('#')) { return }
  $i = $l.IndexOf('=')
  if ($i -lt 1) { return }
  $map[$l.Substring(0, $i)] = $l.Substring($i + 1)
}

$s = $map['InvoiceLens__Sql__ServerHost']
$d = $map['InvoiceLens__Sql__DatabaseName']
$u = $map['InvoiceLens__Sql__Username']
$p = $map['InvoiceLens__Sql__Password']

$sqlcmd = 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE'

$existsOutput = & $sqlcmd -S $s -U $u -P $p -d $d -N -C -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN OBJECT_ID('dbo.OpenInvoiceSyncRuns','U') IS NULL THEN 0 ELSE 1 END"
if ($LASTEXITCODE -ne 0) { throw 'Could not query OpenInvoiceSyncRuns existence' }
$exists = [int]($existsOutput | Select-Object -First 1)

if ($exists -eq 0) {
  & $sqlcmd -S $s -U $u -P $p -d $d -N -C -b -i '.\database\migrations\008_create_openinvoice_tables.sql'
  if ($LASTEXITCODE -ne 0) { throw 'Failed applying 008_create_openinvoice_tables.sql' }
  Write-Host 'APPLIED_008_OPENINVOICE_TABLES'
}
else {
  Write-Host 'OPENINVOICE_TABLES_ALREADY_PRESENT'
}

& $sqlcmd -S $s -U $u -P $p -d $d -N -C -b -Q "SELECT
  CASE WHEN OBJECT_ID('dbo.OpenInvoiceSyncRuns','U') IS NOT NULL THEN 1 ELSE 0 END AS HasOpenInvoiceSyncRuns,
  CASE WHEN OBJECT_ID('dbo.OpenInvoiceRawDocuments','U') IS NOT NULL THEN 1 ELSE 0 END AS HasOpenInvoiceRawDocuments,
  (SELECT COUNT(1) FROM dbo.Invoice) AS InvoiceCount;"
if ($LASTEXITCODE -ne 0) { throw 'OpenInvoice table verification failed' }
