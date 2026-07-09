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

function Test-ResourceExists {
  param(
    [string]$ResourceGroup,
    [string]$ResourceType,
    [string]$Name
  )

  $resourceId = az resource show --resource-group $ResourceGroup --resource-type $ResourceType --name $Name --query id -o tsv 2>$null
  return -not [string]::IsNullOrWhiteSpace($resourceId)
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
Load-EnvStack -RootPath $repoRoot -FileNames @('.env', '.env.dev')

$environmentName = if ($env:INVOICELENS_INFRA_ENVIRONMENT) { $env:INVOICELENS_INFRA_ENVIRONMENT } else { 'dev' }
$resourcePrefix = if ($env:INVOICELENS_INFRA_RESOURCE_PREFIX) { $env:INVOICELENS_INFRA_RESOURCE_PREFIX } else { 'invoicelens' }

$resourceGroupName = "$resourcePrefix-$environmentName-rg"
$apiAppName = "$resourcePrefix-$environmentName-api"
$webAppName = "$resourcePrefix-$environmentName-web"
$openInvoiceMockAppName = "$resourcePrefix-$environmentName-openinvoicemock"
$workerJobName = "$resourcePrefix-$environmentName-worker-job"

$deployWorker = if ($env:INVOICELENS_INFRA_DEV_DEPLOY_WORKER_JOB) { $env:INVOICELENS_INFRA_DEV_DEPLOY_WORKER_JOB } else { 'false' }
$deployOpenInvoiceMock = if ($env:INVOICELENS_INFRA_DEV_DEPLOY_OPENINVOICE_MOCK) { $env:INVOICELENS_INFRA_DEV_DEPLOY_OPENINVOICE_MOCK } else { 'false' }

$apiImage = if ($env:INVOICELENS_API_IMAGE) { $env:INVOICELENS_API_IMAGE } else { "invoicelens-api:$environmentName" }
$webImage = if ($env:INVOICELENS_WEB_IMAGE) { $env:INVOICELENS_WEB_IMAGE } else { "invoicelens-web:$environmentName" }
$openInvoiceMockImage = if ($env:INVOICELENS_OPENINVOICEMOCK_IMAGE) { $env:INVOICELENS_OPENINVOICEMOCK_IMAGE } else { "invoicelens-openinvoicemock:$environmentName" }
$workerImage = if ($env:INVOICELENS_WORKER_IMAGE) { $env:INVOICELENS_WORKER_IMAGE } else { "invoicelens-worker:$environmentName" }

$acrName = az acr list --resource-group $resourceGroupName --query "[0].name" -o tsv
if ([string]::IsNullOrWhiteSpace($acrName)) {
  throw "No Azure Container Registry found in resource group '$resourceGroupName'. Deploy infrastructure first."
}

$acrLoginServer = az acr show --name $acrName --query loginServer -o tsv

az acr update --name $acrName --admin-enabled true | Out-Null
$acrUsername = az acr credential show --name $acrName --query username -o tsv
$acrPassword = az acr credential show --name $acrName --query "passwords[0].value" -o tsv

if (Test-ResourceExists -ResourceGroup $resourceGroupName -ResourceType 'Microsoft.Web/sites' -Name $apiAppName) {
  az webapp config container set --resource-group $resourceGroupName --name $apiAppName --container-image-name "$acrLoginServer/$apiImage" --container-registry-url "https://$acrLoginServer" --container-registry-user $acrUsername --container-registry-password $acrPassword | Out-Null
  Write-Host "Updated API app container image: $acrLoginServer/$apiImage"
}

if (Test-ResourceExists -ResourceGroup $resourceGroupName -ResourceType 'Microsoft.Web/sites' -Name $webAppName) {
  az webapp config container set --resource-group $resourceGroupName --name $webAppName --container-image-name "$acrLoginServer/$webImage" --container-registry-url "https://$acrLoginServer" --container-registry-user $acrUsername --container-registry-password $acrPassword | Out-Null
  Write-Host "Updated Web app container image: $acrLoginServer/$webImage"
}

if ($deployOpenInvoiceMock -eq 'true' -and (Test-ResourceExists -ResourceGroup $resourceGroupName -ResourceType 'Microsoft.Web/sites' -Name $openInvoiceMockAppName)) {
  az webapp config container set --resource-group $resourceGroupName --name $openInvoiceMockAppName --container-image-name "$acrLoginServer/$openInvoiceMockImage" --container-registry-url "https://$acrLoginServer" --container-registry-user $acrUsername --container-registry-password $acrPassword | Out-Null
  Write-Host "Updated OpenInvoiceMock app container image: $acrLoginServer/$openInvoiceMockImage"
}

if ($deployWorker -eq 'true' -and (Test-ResourceExists -ResourceGroup $resourceGroupName -ResourceType 'Microsoft.App/jobs' -Name $workerJobName)) {
  az containerapp job update --resource-group $resourceGroupName --name $workerJobName --image "$acrLoginServer/$workerImage" --registry-server $acrLoginServer --registry-username $acrUsername --registry-password $acrPassword | Out-Null
  Write-Host "Updated Worker job container image: $acrLoginServer/$workerImage"
}

$apiHost = az webapp show --resource-group $resourceGroupName --name $apiAppName --query defaultHostName -o tsv 2>$null
if (-not [string]::IsNullOrWhiteSpace($apiHost)) {
  Write-Host "API health URL: https://$apiHost/health"
}
