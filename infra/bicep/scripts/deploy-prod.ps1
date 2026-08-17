$ErrorActionPreference = "Stop"

& (Join-Path $PSScriptRoot 'deploy-infra.ps1') -Environment 'prod'
