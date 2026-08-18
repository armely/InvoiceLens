$ErrorActionPreference = 'Stop'
$envFile = 'c:\Users\lmwangi\Desktop\InvoiceLens\.env'
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

& 'C:\Program Files\Microsoft SQL Server\Client SDK\ODBC\170\Tools\Binn\SQLCMD.EXE' -S $s -U $u -P $p -d $d -N -C -l 30 -b -Q "SELECT DB_NAME() AS DbName, SUSER_SNAME() AS LoginName"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host 'SQL_LOGIN_OK'
