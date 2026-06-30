param(
  [string]$TemplatePath = "../main.bicep"
)

$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot
try {
  $resolved = Resolve-Path $TemplatePath
  az bicep build --file $resolved
  Write-Host "Bicep compilation succeeded: $resolved"
}
finally {
  Pop-Location
}
