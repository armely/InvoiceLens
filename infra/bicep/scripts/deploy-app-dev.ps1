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

function Normalize-AcrImageReference {
  param(
    [string]$Image,
    [string]$AcrLoginServer
  )

  if ([string]::IsNullOrWhiteSpace($Image)) {
    return $Image
  }

  $normalized = $Image.Trim()
  $prefix = "$AcrLoginServer/"

  if ($normalized.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $normalized.Substring($prefix.Length)
  }

  return $normalized.TrimStart('/')
}

function Test-AcrImageExists {
  param(
    [string]$AcrName,
    [string]$ImageReference
  )

  $value = az acr repository show --name $AcrName --image $ImageReference --query name -o tsv 2>$null
  return -not [string]::IsNullOrWhiteSpace($value)
}

function Disable-WebAppManagedIdentityImagePull {
  param(
    [string]$ResourceGroup,
    [string]$AppName
  )

  $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("invoicelens-acr-config-{0}.json" -f $AppName)
  $payload = @{ acrUseManagedIdentityCreds = $false; acrUserManagedIdentityID = $null } | ConvertTo-Json -Compress

  Set-Content -LiteralPath $tempFile -Value $payload -Encoding ascii
  try {
    az webapp config set --resource-group $ResourceGroup --name $AppName --generic-configurations "@$tempFile" | Out-Null
  }
  finally {
    Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
  }
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

$apiImageRef = Normalize-AcrImageReference -Image $apiImage -AcrLoginServer $acrLoginServer
$webImageRef = Normalize-AcrImageReference -Image $webImage -AcrLoginServer $acrLoginServer
$openInvoiceMockImageRef = Normalize-AcrImageReference -Image $openInvoiceMockImage -AcrLoginServer $acrLoginServer
$workerImageRef = Normalize-AcrImageReference -Image $workerImage -AcrLoginServer $acrLoginServer

if (Test-ResourceExists -ResourceGroup $resourceGroupName -ResourceType 'Microsoft.Web/sites' -Name $apiAppName) {
  if (-not (Test-AcrImageExists -AcrName $acrName -ImageReference $apiImageRef)) {
    throw "API image '$apiImageRef' was not found in ACR '$acrName'. Build/push the image first."
  }
}

if (Test-ResourceExists -ResourceGroup $resourceGroupName -ResourceType 'Microsoft.Web/sites' -Name $webAppName) {
  if (-not (Test-AcrImageExists -AcrName $acrName -ImageReference $webImageRef)) {
    throw "Web image '$webImageRef' was not found in ACR '$acrName'. Build/push the image first."
  }
}

if ($deployOpenInvoiceMock -eq 'true' -and (Test-ResourceExists -ResourceGroup $resourceGroupName -ResourceType 'Microsoft.Web/sites' -Name $openInvoiceMockAppName)) {
  if (-not (Test-AcrImageExists -AcrName $acrName -ImageReference $openInvoiceMockImageRef)) {
    throw "OpenInvoiceMock image '$openInvoiceMockImageRef' was not found in ACR '$acrName'. Build/push the image first."
  }
}

if ($deployWorker -eq 'true' -and (Test-ResourceExists -ResourceGroup $resourceGroupName -ResourceType 'Microsoft.App/jobs' -Name $workerJobName)) {
  if (-not (Test-AcrImageExists -AcrName $acrName -ImageReference $workerImageRef)) {
    throw "Worker image '$workerImageRef' was not found in ACR '$acrName'. Build/push the image first."
  }
}

if (Test-ResourceExists -ResourceGroup $resourceGroupName -ResourceType 'Microsoft.Web/sites' -Name $apiAppName) {
  az webapp config container set --resource-group $resourceGroupName --name $apiAppName --container-image-name "$acrLoginServer/$apiImageRef" --container-registry-url "https://$acrLoginServer" --container-registry-user $acrUsername --container-registry-password $acrPassword | Out-Null
  Disable-WebAppManagedIdentityImagePull -ResourceGroup $resourceGroupName -AppName $apiAppName
  az webapp restart --resource-group $resourceGroupName --name $apiAppName | Out-Null
  Write-Host "Updated API app container image: $acrLoginServer/$apiImageRef"
}

if (Test-ResourceExists -ResourceGroup $resourceGroupName -ResourceType 'Microsoft.Web/sites' -Name $webAppName) {
  az webapp config container set --resource-group $resourceGroupName --name $webAppName --container-image-name "$acrLoginServer/$webImageRef" --container-registry-url "https://$acrLoginServer" --container-registry-user $acrUsername --container-registry-password $acrPassword | Out-Null
  Disable-WebAppManagedIdentityImagePull -ResourceGroup $resourceGroupName -AppName $webAppName
  az webapp restart --resource-group $resourceGroupName --name $webAppName | Out-Null
  Write-Host "Updated Web app container image: $acrLoginServer/$webImageRef"
}

if ($deployOpenInvoiceMock -eq 'true' -and (Test-ResourceExists -ResourceGroup $resourceGroupName -ResourceType 'Microsoft.Web/sites' -Name $openInvoiceMockAppName)) {
  az webapp config container set --resource-group $resourceGroupName --name $openInvoiceMockAppName --container-image-name "$acrLoginServer/$openInvoiceMockImageRef" --container-registry-url "https://$acrLoginServer" --container-registry-user $acrUsername --container-registry-password $acrPassword | Out-Null
  Disable-WebAppManagedIdentityImagePull -ResourceGroup $resourceGroupName -AppName $openInvoiceMockAppName
  az webapp restart --resource-group $resourceGroupName --name $openInvoiceMockAppName | Out-Null
  Write-Host "Updated OpenInvoiceMock app container image: $acrLoginServer/$openInvoiceMockImageRef"
}

if ($deployWorker -eq 'true' -and (Test-ResourceExists -ResourceGroup $resourceGroupName -ResourceType 'Microsoft.App/jobs' -Name $workerJobName)) {
  az containerapp job update --resource-group $resourceGroupName --name $workerJobName --image "$acrLoginServer/$workerImage" --registry-server $acrLoginServer --registry-username $acrUsername --registry-password $acrPassword | Out-Null
  Write-Host "Updated Worker job container image: $acrLoginServer/$workerImage"
}

$apiHost = az webapp show --resource-group $resourceGroupName --name $apiAppName --query defaultHostName -o tsv 2>$null
if (-not [string]::IsNullOrWhiteSpace($apiHost)) {
  Write-Host "API health URL: https://$apiHost/health"
}

$webHost = az webapp show --resource-group $resourceGroupName --name $webAppName --query defaultHostName -o tsv 2>$null
if (-not [string]::IsNullOrWhiteSpace($webHost)) {
  Write-Host "Web URL: https://$webHost"
}
