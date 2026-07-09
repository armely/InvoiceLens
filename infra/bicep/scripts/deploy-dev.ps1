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
Load-EnvStack -RootPath $repoRoot -FileNames @('.env', '.env.dev')

$deploymentName = if ($env:INVOICELENS_INFRA_DEV_DEPLOYMENT_NAME) { $env:INVOICELENS_INFRA_DEV_DEPLOYMENT_NAME } else { 'invoicelens-dev-infra' }
$resourcePrefix = if ($env:INVOICELENS_INFRA_RESOURCE_PREFIX) { $env:INVOICELENS_INFRA_RESOURCE_PREFIX } else { 'invoicelens' }
$location = if ($env:INVOICELENS_INFRA_DEV_LOCATION) { $env:INVOICELENS_INFRA_DEV_LOCATION } else { 'eastus' }
$sqlLocation = if ($env:INVOICELENS_INFRA_DEV_SQL_LOCATION) { $env:INVOICELENS_INFRA_DEV_SQL_LOCATION } else { 'eastus2' }

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

if ($env:InvoiceLens__Auth__ClientId) {
  $parameterOverrides += "authClientId=$($env:InvoiceLens__Auth__ClientId)"
}

if ($env:InvoiceLens__Auth__TenantId) {
  $parameterOverrides += "authTenantId=$($env:InvoiceLens__Auth__TenantId)"
}

if ($env:OpenInvoice__HmacSigningKey) {
  $parameterOverrides += "openInvoiceHmacSigningKey=$($env:OpenInvoice__HmacSigningKey)"
}

if ($env:INVOICELENS_INFRA_DEV_APP_SERVICE_PLAN_SKU_NAME) {
  $parameterOverrides += "appServicePlanSkuName=$($env:INVOICELENS_INFRA_DEV_APP_SERVICE_PLAN_SKU_NAME)"
}

if ($env:INVOICELENS_INFRA_DEV_APP_SERVICE_PLAN_SKU_TIER) {
  $parameterOverrides += "appServicePlanSkuTier=$($env:INVOICELENS_INFRA_DEV_APP_SERVICE_PLAN_SKU_TIER)"
}

if ($env:INVOICELENS_INFRA_DEV_APP_SERVICE_PLAN_SKU_CAPACITY) {
  $parameterOverrides += "appServicePlanSkuCapacity=$($env:INVOICELENS_INFRA_DEV_APP_SERVICE_PLAN_SKU_CAPACITY)"
}

if ($env:INVOICELENS_INFRA_DEV_DEPLOY_APP_SERVICE_WEB_API) {
  $parameterOverrides += "deployAppServiceWebApi=$($env:INVOICELENS_INFRA_DEV_DEPLOY_APP_SERVICE_WEB_API)"
}

if ($env:INVOICELENS_INFRA_DEV_DEPLOY_CONTAINER_APP_WEB_API) {
  $parameterOverrides += "deployContainerAppWebApi=$($env:INVOICELENS_INFRA_DEV_DEPLOY_CONTAINER_APP_WEB_API)"
}

if ($env:INVOICELENS_INFRA_DEV_DEPLOY_WORKER_JOB) {
  $parameterOverrides += "deployWorkerJob=$($env:INVOICELENS_INFRA_DEV_DEPLOY_WORKER_JOB)"
}

if ($env:INVOICELENS_INFRA_DEV_DEPLOY_OPENINVOICE_MOCK) {
  $parameterOverrides += "deployOpenInvoiceMock=$($env:INVOICELENS_INFRA_DEV_DEPLOY_OPENINVOICE_MOCK)"
}

$azArgs = @(
  'deployment', 'sub', 'create',
  '--name', $deploymentName,
  '--location', $location,
  '--template-file', '../main.bicep',
  '--parameters', '../parameters/dev.bicepparam',
  '--parameters'
) + $parameterOverrides

Push-Location $PSScriptRoot
try {
  az @azArgs
}
finally {
  Pop-Location
}
