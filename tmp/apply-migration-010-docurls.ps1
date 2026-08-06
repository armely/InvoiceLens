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
& $sqlcmd -S $envMap['InvoiceLens__Sql__ServerHost'] -U $envMap['InvoiceLens__Sql__Username'] -P $envMap['InvoiceLens__Sql__Password'] -d $envMap['InvoiceLens__Sql__DatabaseName'] -N -C -b -i 'database/migrations/010_add_document_urls.sql'
