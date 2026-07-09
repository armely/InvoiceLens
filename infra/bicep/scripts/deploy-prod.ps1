$ErrorActionPreference = "Stop"

function Load-DotEnvFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) {
      return
    }

    if ($line.StartsWith('export ')) {
      $line = $line.Substring(7).TrimStart()
    }

    $separatorIndex = $line.IndexOf('=')
    if ($separatorIndex -le 0) {
      return
    }

    $key = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()

    if ($value.Length -ge 2) {
      $first = $value[0]
      $last = $value[$value.Length - 1]
      if (($first -eq '"' -and $last -eq '"') -or ($first -eq "'" -and $last -eq "'")) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }

    if (-not [string]::IsNullOrWhiteSpace($key)) {
      Set-Item -Path "Env:$key" -Value $value
    }
  }
}

function Load-EnvStack {
  param(
    [string]$RootPath,
    [string[]]$FileNames
  )

  foreach ($fileName in $FileNames) {
    Load-DotEnvFile -Path (Join-Path $RootPath $fileName)
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Load-EnvStack -RootPath $repoRoot -FileNames @('.env', '.env.prod')

$deploymentName = if ($env:INVOICELENS_INFRA_PROD_DEPLOYMENT_NAME) { $env:INVOICELENS_INFRA_PROD_DEPLOYMENT_NAME } else { 'invoicelens-prod-infra' }
$resourcePrefix = if ($env:INVOICELENS_INFRA_RESOURCE_PREFIX) { $env:INVOICELENS_INFRA_RESOURCE_PREFIX } else { 'invoicelens' }
$location = if ($env:INVOICELENS_INFRA_PROD_LOCATION) { $env:INVOICELENS_INFRA_PROD_LOCATION } else { 'centralus' }
$sqlLocation = if ($env:INVOICELENS_INFRA_PROD_SQL_LOCATION) { $env:INVOICELENS_INFRA_PROD_SQL_LOCATION } else { $location }

$parameterOverrides = @(
  "resourcePrefix=$resourcePrefix",
  "location=$location",
  "sqlLocation=$sqlLocation"
)

if ($env:INVOICELENS_INFRA_SQL_ADMIN_LOGIN) {
  $parameterOverrides += "sqlAdminLogin=$($env:INVOICELENS_INFRA_SQL_ADMIN_LOGIN)"
}

if ($env:INVOICELENS_INFRA_SQL_ADMIN_PASSWORD) {
  $parameterOverrides += "sqlAdminPassword=$($env:INVOICELENS_INFRA_SQL_ADMIN_PASSWORD)"
}

$azArgs = @(
  'deployment', 'sub', 'create',
  '--name', $deploymentName,
  '--location', $location,
  '--template-file', '../main.bicep',
  '--parameters', '../parameters/prod.bicepparam',
  '--parameters'
) + $parameterOverrides

Push-Location $PSScriptRoot
try {
  az @azArgs
}
finally {
  Pop-Location
}
