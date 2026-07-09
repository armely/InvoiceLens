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

Require-Command -Name az

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Set-Location $repoRoot

$environmentName = if ($env:INVOICELENS_INFRA_ENVIRONMENT) { $env:INVOICELENS_INFRA_ENVIRONMENT } else { 'dev' }
$resourcePrefix = if ($env:INVOICELENS_INFRA_RESOURCE_PREFIX) { $env:INVOICELENS_INFRA_RESOURCE_PREFIX } else { 'invoicelens' }
$resourceGroupName = "$resourcePrefix-$environmentName-rg"

Invoke-Step -Label 'Deploy infrastructure' -Action {
  & (Join-Path $repoRoot 'infra\bicep\scripts\deploy-dev.ps1')
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
  $apiStatus = (Invoke-WebRequest -Uri 'https://invoicelensx-dev-api.azurewebsites.net/health' -UseBasicParsing).StatusCode
  $webStatus = (Invoke-WebRequest -Uri 'https://invoicelensx-dev-web.azurewebsites.net' -UseBasicParsing).StatusCode

  Write-Host "API health status: $apiStatus" -ForegroundColor Green
  Write-Host "Web status: $webStatus" -ForegroundColor Green
}

Write-Host "`nDeployment complete." -ForegroundColor Green