$ErrorActionPreference = 'Stop'
Set-Location 'c:\Users\lmwangi\Desktop\InvoiceLens'

$envPath = '.env'
if (-not (Test-Path $envPath)) {
  throw '.env not found in repo root.'
}

$vars = @{}
foreach ($raw in Get-Content $envPath) {
  $line = $raw.Trim()
  if (-not $line -or $line.StartsWith('#')) { continue }
  $idx = $line.IndexOf('=')
  if ($idx -lt 1) { continue }
  $key = $line.Substring(0, $idx).Trim()
  $value = $line.Substring($idx + 1).Trim()
  $vars[$key] = $value
}

$server = $vars['InvoiceLens__Sql__ServerHost']
$user = $vars['InvoiceLens__Sql__Username']
$pass = $vars['InvoiceLens__Sql__Password']
if (-not $server -or -not $user -or -not $pass) {
  throw 'Missing SQL credentials in .env'
}

$newDb = 'InvoiceLens_' + (Get-Date -Format 'yyyyMMdd_HHmmss')

sqlcmd -S $server -U $user -P $pass -d master -b -Q "IF DB_ID(N'$newDb') IS NULL CREATE DATABASE [$newDb];"
sqlcmd -S $server -U $user -P $pass -d $newDb -b -i '.\database\scripts\create-schema.sql'
sqlcmd -S $server -U $user -P $pass -d $newDb -b -i '.\database\scripts\create-indexes.sql'

$updated = foreach ($raw in Get-Content $envPath) {
  if ($raw -match '^\s*InvoiceLens__Sql__DatabaseName=') {
    "InvoiceLens__Sql__DatabaseName=$newDb"
  }
  else {
    $raw
  }
}
$updated | Set-Content -Path $envPath -Encoding UTF8

Write-Host "CREATED_DB=$newDb"
