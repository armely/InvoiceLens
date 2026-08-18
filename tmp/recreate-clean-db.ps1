$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $repoRoot '.env'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw ".env file not found at $envFile"
}

$envMap = @{}
Get-Content -LiteralPath $envFile | ForEach-Object {
  $line = $_.Trim()
  if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
    return
  }

  if ($line.StartsWith('export ')) {
    $line = $line.Substring(7).TrimStart()
  }

  $idx = $line.IndexOf('=')
  if ($idx -le 0) {
    return
  }

  $key = $line.Substring(0, $idx).Trim()
  $value = $line.Substring($idx + 1).Trim()

  if ($value.Length -ge 2) {
    $first = $value[0]
    $last = $value[$value.Length - 1]
    if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
      $value = $value.Substring(1, $value.Length - 2)
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($key)) {
    $envMap[$key] = $value
  }
}

$server = $envMap['InvoiceLens__Sql__ServerHost']
$db = $envMap['InvoiceLens__Sql__DatabaseName']
$user = $envMap['InvoiceLens__Sql__Username']
$pass = $envMap['InvoiceLens__Sql__Password']
$encrypt = $envMap['InvoiceLens__Sql__Encrypt']
$trust = $envMap['InvoiceLens__Sql__TrustServerCertificate']

if ([string]::IsNullOrWhiteSpace($server) -or [string]::IsNullOrWhiteSpace($db) -or [string]::IsNullOrWhiteSpace($user) -or [string]::IsNullOrWhiteSpace($pass)) {
  throw 'Missing SQL settings in .env.'
}

$timestamp = (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmmss')
$newDbName = "InvoiceLens_$timestamp"

function New-ConnectionString([string]$catalog) {
  $builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
  $builder['Data Source'] = $server
  $builder['Initial Catalog'] = $catalog
  $builder['User ID'] = $user
  $builder['Password'] = $pass
  $builder['Encrypt'] = [Convert]::ToBoolean($encrypt)
  $builder['TrustServerCertificate'] = [Convert]::ToBoolean($trust)
  $builder['Connect Timeout'] = 30
  return $builder.ConnectionString
}

function Invoke-NonQuery([string]$connectionString, [string]$sql, [int]$timeout = 120) {
  $conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
  $conn.Open()
  try {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $sql
    $cmd.CommandTimeout = $timeout
    [void]$cmd.ExecuteNonQuery()
  }
  finally {
    $conn.Close()
  }
}

function Invoke-Scalar([string]$connectionString, [string]$sql, [int]$timeout = 60) {
  $conn = New-Object System.Data.SqlClient.SqlConnection($connectionString)
  $conn.Open()
  try {
    $cmd = $conn.CreateCommand()
    $cmd.CommandText = $sql
    $cmd.CommandTimeout = $timeout
    return $cmd.ExecuteScalar()
  }
  finally {
    $conn.Close()
  }
}

$masterCs = New-ConnectionString -catalog 'master'
Invoke-NonQuery -connectionString $masterCs -sql "CREATE DATABASE [$newDbName];" -timeout 180

$isOnline = $false
for ($i = 0; $i -lt 30; $i++) {
  $state = Invoke-Scalar -connectionString $masterCs -sql "SELECT state_desc FROM sys.databases WHERE name = '$newDbName';"
  if ($state -eq 'ONLINE') {
    $isOnline = $true
    break
  }
  Start-Sleep -Milliseconds 500
}

if (-not $isOnline) {
  throw "Database $newDbName was created but did not reach ONLINE state in time."
}

$newCs = New-ConnectionString -catalog $newDbName
$schemaSqlPath = Join-Path $repoRoot 'database\scripts\create-schema.sql'
$schemaSql = Get-Content -LiteralPath $schemaSqlPath -Raw
Invoke-NonQuery -connectionString $newCs -sql $schemaSql -timeout 300

$line = "InvoiceLens__Sql__DatabaseName=$newDbName"
$envLines = Get-Content -LiteralPath $envFile
$updated = $false
for ($i = 0; $i -lt $envLines.Count; $i++) {
  if ($envLines[$i] -match '^\s*InvoiceLens__Sql__DatabaseName\s*=') {
    $envLines[$i] = $line
    $updated = $true
    break
  }
}
if (-not $updated) {
  $envLines += $line
}
Set-Content -LiteralPath $envFile -Value $envLines -Encoding UTF8

Write-Host "Created clean database: $newDbName" -ForegroundColor Green
Write-Host "Updated .env to use new database name." -ForegroundColor Green
