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
$out = 'tmp/docurl-columns-check.txt'
if (Test-Path $out) { Remove-Item $out -Force }

$server = $envMap['InvoiceLens__Sql__ServerHost']
$db = $envMap['InvoiceLens__Sql__DatabaseName']
$user = $envMap['InvoiceLens__Sql__Username']
$pass = $envMap['InvoiceLens__Sql__Password']

& $sqlcmd -S $server -U $user -P $pass -d $db -N -C -W -s '|' -b -Q @"
SELECT DB_NAME() AS DatabaseName;
SELECT TABLE_NAME, COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA='dbo'
  AND TABLE_NAME IN ('InvoiceAttachmentReference','InvoiceAttachments','InvoiceSnapshots')
  AND COLUMN_NAME='DocumentUrl'
ORDER BY TABLE_NAME;
"@ | Out-File -FilePath $out -Encoding utf8

Get-Content $out
