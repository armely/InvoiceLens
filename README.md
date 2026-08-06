# InvoiceLens

InvoiceLens is a local-first invoice operations application with a .NET API, a background worker for invoice sync, an OpenInvoice-compatible mock, and a lightweight web frontend.

## What this repo contains

- API: [src/InvoiceLens.Api](src/InvoiceLens.Api)
- Worker: [src/InvoiceLens.Worker](src/InvoiceLens.Worker)
- Infrastructure and sync logic: [src/InvoiceLens.Infrastructure](src/InvoiceLens.Infrastructure)
- Local OpenInvoice mock: [src/InvoiceLens.OpenInvoiceMock](src/InvoiceLens.OpenInvoiceMock)
- Web app: [apps/web](apps/web)

## Prerequisites

- .NET SDK 10.x
- Node.js 20.x
- SQL Server or Azure SQL access

## Local configuration

Create a root [\.env](.env) file from [\.env.example](.env.example) and fill in:

- SQL values under `InvoiceLens__Sql__*`
- OpenInvoice values under `OpenInvoice__*`
- Auth values under `InvoiceLens__Auth__*`

## Run locally

### Start the full local stack

```powershell
Set-Location "C:\Users\lmwangi\Desktop\InvoiceLens"
.\scripts\start-local-stack.ps1
```

### Stop the local stack

```powershell
Set-Location "C:\Users\lmwangi\Desktop\InvoiceLens"
.\scripts\stop-local-stack.ps1
```

### Manual run (if needed)

Backend:

```powershell
Set-Location "C:\Users\lmwangi\Desktop\InvoiceLens"
.\tmp\dotnet10\dotnet.exe run --project src\InvoiceLens.Api --no-build
```

Worker:

```powershell
Set-Location "C:\Users\lmwangi\Desktop\InvoiceLens"
.\tmp\dotnet10\dotnet.exe run --project src\InvoiceLens.Worker --no-build
```

OpenInvoice mock:

```powershell
Set-Location "C:\Users\lmwangi\Desktop\InvoiceLens"
.\tmp\dotnet10\dotnet.exe run --project src\InvoiceLens.OpenInvoiceMock --no-build
```

Frontend:

```powershell
Set-Location "C:\Users\lmwangi\Desktop\InvoiceLens\apps\web"
& "C:\Users\lmwangi\Desktop\InvoiceLens\tmp\node\node-v20.19.5-win-x64\node.exe" .\scripts\serve.mjs
```

## Local endpoints

- API health: http://localhost:5106/health
- Web app: http://localhost:4200
- OpenInvoice mock health: http://localhost:5189/health

## Notes

- The local stack uses the bundled .NET SDK and Node runtime under [tmp](tmp) for consistency.
- The worker uses the local mock endpoint from the root [.env](.env) file when `OpenInvoice__UseMock=true`.

## Quick troubleshooting

- If the API exits immediately, check SQL connectivity and the values in [.env](.env).
- If the UI shows a 401, sign in through the API auth session flow before loading protected endpoints.
- If sync does not appear, confirm the mock endpoint is reachable and `OpenInvoice__UseMock=true`.

- Web App Service container image
- Optional OpenInvoiceMock and Worker image targets (based on flags)

### 7. Apply Database Schema

Run SQL scripts against your target SQL database.

Example with sqlcmd:

```powershell
sqlcmd -S <server> -d <database> -U <username> -P <password> -i database/scripts/create-schema.sql
sqlcmd -S <server> -d <database> -U <username> -P <password> -i database/scripts/create-indexes.sql
```

Optional seed data for non-prod:

```powershell
sqlcmd -S <server> -d <database> -U <username> -P <password> -i database/scripts/seed-local-data.sql
```

### 8. Verify Deployment

```powershell
$ApiAppName = "$Prefix-$EnvName-api"
$WebAppName = "$Prefix-$EnvName-web"

$ApiHost = az webapp show --resource-group $ResourceGroup --name $ApiAppName --query defaultHostName -o tsv
$WebHost = az webapp show --resource-group $ResourceGroup --name $WebAppName --query defaultHostName -o tsv

Write-Host "API Health: https://$ApiHost/health"
Write-Host "Web URL:    https://$WebHost"
```

Open the printed URLs and confirm:

- API health endpoint returns 200
- Web loads and can authenticate
- Web can fetch API data

### 9. Quick Command Packs

Dev full flow:

```powershell
az login
az account set --subscription <subscription-id-or-name>
pwsh ./infra/bicep/scripts/deploy-dev.ps1

$EnvName = "dev"
$Prefix = "invoicelensx"
$ResourceGroup = "$Prefix-$EnvName-rg"
$AcrName = az acr list --resource-group $ResourceGroup --query "[0].name" -o tsv

az acr build --registry $AcrName --image invoicelens-api:$EnvName --file src/InvoiceLens.Api/Dockerfile .
az acr build --registry $AcrName --image invoicelens-web:$EnvName --file apps/web/Dockerfile .

pwsh ./infra/bicep/scripts/deploy-app-dev.ps1
```

Test infra only:

```powershell
az login
az account set --subscription <subscription-id-or-name>
pwsh ./infra/bicep/scripts/deploy-test.ps1
```

Prod infra only:

```powershell
az login
az account set --subscription <subscription-id-or-name>
pwsh ./infra/bicep/scripts/deploy-prod.ps1
```

### 10. Common Deployment Errors

- ACR not found in resource group:
  - Run infra deployment first.
  - Confirm Prefix and EnvName values match deployed resource naming.
- Web starts but API calls fail:
  - Verify API app is running and healthy.
  - Check API_BASE_URL and app settings.
- SQL connection failures after deployment:
  - Confirm SQL firewall rules.
  - Confirm InvoiceLens__Sql__ values and restart app.
