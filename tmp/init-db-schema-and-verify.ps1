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

& $sqlcmd -S $s -U $u -P $p -d $d -N -C -b -i '.\database\scripts\create-schema.sql'
if ($LASTEXITCODE -ne 0) { throw 'create-schema.sql failed' }

& $sqlcmd -S $s -U $u -P $p -d $d -N -C -b -i '.\database\scripts\create-indexes.sql'
if ($LASTEXITCODE -ne 0) { throw 'create-indexes.sql failed' }

& $sqlcmd -S $s -U $u -P $p -d $d -N -C -b -Q "SELECT
  CASE WHEN OBJECT_ID('dbo.Invoice','U') IS NOT NULL THEN 1 ELSE 0 END AS HasInvoice,
  CASE WHEN OBJECT_ID('dbo.InvoiceLine','U') IS NOT NULL THEN 1 ELSE 0 END AS HasInvoiceLine,
  CASE WHEN OBJECT_ID('dbo.SyncBatch','U') IS NOT NULL THEN 1 ELSE 0 END AS HasSyncBatch,
  CASE WHEN OBJECT_ID('dbo.OpenInvoiceRawDocument','U') IS NOT NULL THEN 1 ELSE 0 END AS HasOpenInvoiceRawDocument,
  (SELECT COUNT(1) FROM dbo.Invoice) AS InvoiceCount;"
if ($LASTEXITCODE -ne 0) { throw 'verification query failed' }

Write-Host 'DB_SCHEMA_AND_INDEXES_OK'
