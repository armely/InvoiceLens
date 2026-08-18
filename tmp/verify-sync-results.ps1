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

& $sqlcmd -S $s -U $u -P $p -d $d -N -C -b -Q "SELECT COUNT(1) AS InvoiceCount FROM dbo.Invoice;"
& $sqlcmd -S $s -U $u -P $p -d $d -N -C -b -Q "SELECT TOP 5 JobName, Status, StartedAtUtc, CompletedAtUtc, RecordsRequested, RecordsImported, RecordsFailed, LEFT(ISNULL(ErrorMessage,''),200) AS ErrorPreview FROM dbo.OpenInvoiceSyncRuns ORDER BY StartedAtUtc DESC;"
