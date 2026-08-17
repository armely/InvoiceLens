$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [string]$Label,
    [scriptblock]$Action
  )

  Write-Host "`n=== $Label ===" -ForegroundColor Cyan
  & $Action
}

function Require-Command {
  param([string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found in PATH."
  }
}

function Get-ResourceCount {
  param(
    [string]$ResourceGroup,
    [string]$ResourceType
  )

  $json = az resource list --resource-group $ResourceGroup --resource-type $ResourceType -o json 2>$null
  if ([string]::IsNullOrWhiteSpace($json)) {
    return 0
  }

  $items = $json | ConvertFrom-Json
  if ($null -eq $items) {
    return 0
  }

  if ($items -is [System.Array]) {
    return $items.Count
  }

  return 1
}

function Get-InfraHealth {
  param([string]$ResourceGroup)

  $checks = @(
    @{ Type = 'Microsoft.ContainerRegistry/registries'; Min = 1; Label = 'ACR' },
    @{ Type = 'Microsoft.KeyVault/vaults'; Min = 1; Label = 'Key Vault' },
    @{ Type = 'Microsoft.Web/serverfarms'; Min = 1; Label = 'App Service Plan' },
    @{ Type = 'Microsoft.Web/sites'; Min = 2; Label = 'Web Apps (API + Web)' },
    @{ Type = 'Microsoft.Sql/servers'; Min = 1; Label = 'SQL Server' },
    @{ Type = 'Microsoft.Sql/servers/databases'; Min = 1; Label = 'SQL Database' }
  )

  $missing = @()
  foreach ($check in $checks) {
    $actual = Get-ResourceCount -ResourceGroup $ResourceGroup -ResourceType $check.Type
    if ($actual -lt $check.Min) {
      $missing += "$($check.Label) ($actual/$($check.Min))"
    }
  }

  return $missing
}

function Resolve-WebAppHost {
  param(
    [string]$ResourceGroup,
    [string]$AppName
  )

  $host = az webapp show --resource-group $ResourceGroup --name $AppName --query defaultHostName -o tsv 2>$null
  if ([string]::IsNullOrWhiteSpace($host)) {
    return $null
  }

  return $host
}

Require-Command -Name az

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Set-Location $repoRoot

$environmentName = if ($env:INVOICELENS_INFRA_ENVIRONMENT) { $env:INVOICELENS_INFRA_ENVIRONMENT } else { 'dev' }
$resourcePrefix = if ($env:INVOICELENS_INFRA_RESOURCE_PREFIX) { $env:INVOICELENS_INFRA_RESOURCE_PREFIX } else { 'invoicelens' }
$resourceGroupName = "$resourcePrefix-$environmentName-rg"
$apiAppName = "$resourcePrefix-$environmentName-api"
$webAppName = "$resourcePrefix-$environmentName-web"

if ($environmentName -ne 'dev') {
  throw "deploy-all-dev.ps1 supports only the dev environment. Set INVOICELENS_INFRA_ENVIRONMENT=dev or use the environment-specific scripts."
}

Invoke-Step -Label 'Check infrastructure state' -Action {
  $rgExists = (az group exists --name $resourceGroupName -o tsv) -eq 'true'
  if (-not $rgExists) {
    Write-Host "Resource group '$resourceGroupName' not found. Infrastructure deployment is required." -ForegroundColor Yellow
    & (Join-Path $repoRoot 'infra\bicep\scripts\deploy-infra.ps1') -Environment 'dev'
    return
  }

  $missingResources = Get-InfraHealth -ResourceGroup $resourceGroupName
  if ($missingResources.Count -eq 0) {
    Write-Host "Infrastructure is complete. Skipping infra deployment." -ForegroundColor Green
    return
  }

  Write-Host "Infrastructure is missing: $($missingResources -join ', ')" -ForegroundColor Yellow
  Write-Host "Reconciling missing resources via infra deployment..." -ForegroundColor Yellow
  & (Join-Path $repoRoot 'infra\bicep\scripts\deploy-infra.ps1') -Environment 'dev'

  $postCheckMissing = Get-InfraHealth -ResourceGroup $resourceGroupName
  if ($postCheckMissing.Count -gt 0) {
    throw "Infrastructure reconciliation completed but resources are still missing: $($postCheckMissing -join ', ')"
  }
}

$acrName = az acr list --resource-group $resourceGroupName --query "[0].name" -o tsv
if ([string]::IsNullOrWhiteSpace($acrName)) {
  throw "No ACR found in resource group '$resourceGroupName'."
}

$apiImage = if ($env:INVOICELENS_API_IMAGE) { $env:INVOICELENS_API_IMAGE } else { "invoicelens-api:$environmentName" }
$webImage = if ($env:INVOICELENS_WEB_IMAGE) { $env:INVOICELENS_WEB_IMAGE } else { "invoicelens-web:$environmentName" }
$openInvoiceMockImage = if ($env:INVOICELENS_OPENINVOICEMOCK_IMAGE) { $env:INVOICELENS_OPENINVOICEMOCK_IMAGE } else { "invoicelens-openinvoicemock:$environmentName" }

Invoke-Step -Label 'Build and push API image' -Action {
  az acr build --registry $acrName --image $apiImage --file src/InvoiceLens.Api/Dockerfile .
}

Invoke-Step -Label 'Build and push Web image' -Action {
  az acr build --registry $acrName --image $webImage --file apps/web/Dockerfile apps/web
}

Invoke-Step -Label 'Build and push OpenInvoiceMock image' -Action {
  az acr build --registry $acrName --image $openInvoiceMockImage --file src/InvoiceLens.OpenInvoiceMock/Dockerfile .
}

Invoke-Step -Label 'Deploy app images to Azure' -Action {
  & (Join-Path $repoRoot 'infra\bicep\scripts\deploy-app-dev.ps1')
}

Invoke-Step -Label 'Verify deployed endpoints' -Action {
  $apiHost = Resolve-WebAppHost -ResourceGroup $resourceGroupName -AppName $apiAppName
  $webHost = Resolve-WebAppHost -ResourceGroup $resourceGroupName -AppName $webAppName

  if ([string]::IsNullOrWhiteSpace($apiHost) -or [string]::IsNullOrWhiteSpace($webHost)) {
    throw "Could not resolve API/Web hostnames for verification."
  }

  $apiStatus = (Invoke-WebRequest -Uri "https://$apiHost/health" -UseBasicParsing).StatusCode
  $webStatus = (Invoke-WebRequest -Uri "https://$webHost" -UseBasicParsing).StatusCode

  Write-Host "API health status: $apiStatus" -ForegroundColor Green
  Write-Host "Web status: $webStatus" -ForegroundColor Green
}

Write-Host "`nDeployment complete." -ForegroundColor Green