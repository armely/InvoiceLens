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

$builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
$builder['Data Source'] = $server
$builder['Initial Catalog'] = $db
$builder['User ID'] = $user
$builder['Password'] = $pass
$builder['Encrypt'] = [Convert]::ToBoolean($encrypt)
$builder['TrustServerCertificate'] = [Convert]::ToBoolean($trust)
$builder['Connect Timeout'] = 30

$connection = New-Object System.Data.SqlClient.SqlConnection($builder.ConnectionString)
$connection.Open()

try {
  $sql = @"
SET NOCOUNT ON;
DECLARE @disable nvarchar(max) = N'';
DECLARE @delete nvarchar(max) = N'';
DECLARE @enable nvarchar(max) = N'';

SELECT @disable = @disable + N'ALTER TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N' NOCHECK CONSTRAINT ALL;' + CHAR(10)
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.is_ms_shipped = 0;

SELECT @delete = @delete + N'DELETE FROM ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N';' + CHAR(10)
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.is_ms_shipped = 0
  AND t.name <> '__EFMigrationsHistory';

SELECT @enable = @enable + N'ALTER TABLE ' + QUOTENAME(s.name) + N'.' + QUOTENAME(t.name) + N' WITH CHECK CHECK CONSTRAINT ALL;' + CHAR(10)
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE t.is_ms_shipped = 0;

EXEC sp_executesql @disable;
EXEC sp_executesql @delete;
EXEC sp_executesql @enable;

SELECT s.name AS SchemaName, t.name AS TableName, SUM(p.rows) AS [RowsRemaining]
FROM sys.tables t
JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)
WHERE t.is_ms_shipped = 0
GROUP BY s.name, t.name
ORDER BY TableName;
"@

  $command = $connection.CreateCommand()
  $command.CommandText = $sql
  $command.CommandTimeout = 240

  $reader = $command.ExecuteReader()
  $rows = @()
  while ($reader.Read()) {
    $rows += [PSCustomObject]@{
      SchemaName = [string]$reader['SchemaName']
      TableName = [string]$reader['TableName']
      RowCount = [int64]$reader['RowsRemaining']
    }
  }
  $reader.Close()

  Write-Host "Purged database '$db' on server '$server'." -ForegroundColor Green
  $rows | Format-Table -AutoSize
}
finally {
  $connection.Close()
}
