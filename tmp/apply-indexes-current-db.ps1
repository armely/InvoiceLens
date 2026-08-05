$ErrorActionPreference = 'Stop'
Set-Location 'c:\Users\lmwangi\Desktop\InvoiceLens'

$envPath = '.env'
$lines = Get-Content $envPath

function Get-EnvValue([string]$key, [string[]]$source) {
  $line = $source | Where-Object { $_ -match "^$([regex]::Escape($key))=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -replace "^$([regex]::Escape($key))=", '').Trim()
}

$server = Get-EnvValue 'InvoiceLens__Sql__ServerHost' $lines
$user = Get-EnvValue 'InvoiceLens__Sql__Username' $lines
$pass = Get-EnvValue 'InvoiceLens__Sql__Password' $lines
$db = Get-EnvValue 'InvoiceLens__Sql__DatabaseName' $lines

if (-not $server -or -not $user -or -not $pass -or -not $db) {
  throw 'Missing SQL env values in .env'
}

sqlcmd -S $server -U $user -P $pass -I -d $db -b -i '.\database\scripts\create-indexes.sql'

Write-Host "INDEXES_OK_FOR=$db"
