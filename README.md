# InvoiceLens

## 1. What InvoiceLens Is

InvoiceLens is an invoice operations platform for reviewing, validating, and syncing invoice data.

It is a multi-service repository with:

- A .NET API for authenticated backend operations.
- A .NET Worker for recurring OpenInvoice synchronization and retry workflows.
- A shared Infrastructure layer for persistence, sync clients, and comparison services.
- An OpenInvoice-compatible mock service for local/dev/test integration validation.
- A framework-free TypeScript web frontend.

## 2. Current Repository Structure

```text
InvoiceLens/
  apps/web/                        TypeScript frontend
  src/                             .NET services and shared layers
    InvoiceLens.Api/
    InvoiceLens.Application/
    InvoiceLens.Domain/
    InvoiceLens.Infrastructure/
    InvoiceLens.Worker/
    InvoiceLens.OpenInvoiceMock/
  database/                        SQL migrations and scripts
  infra/bicep/                     Azure infrastructure templates
    main.bicep
    modules/
    parameters/
    scripts/
  pipelines/                       Azure DevOps pipelines
  docs/                            Architecture, setup, runbooks, discovery
  front-end/                       Design prototype source
```

## 3. Application Components

- `InvoiceLens.Api`: backend entry point for frontend calls, auth session, invoice actions, comparison, and document streaming.
- `InvoiceLens.Worker`: background sync processor for OpenInvoice pull/persist and event outbox post/retry.
- `InvoiceLens.Infrastructure`: SQL access, OpenInvoice client, sync orchestration, local comparison implementation.
- `InvoiceLens.OpenInvoiceMock`: OpenInvoice-style endpoint simulator with security middleware.
- `apps/web`: browser UI and runtime config generation.

## 4. Prerequisites

- .NET SDK 10.x (as used by current solution and pipelines).
- Node.js 20.x (matches current web build pipeline).
- SQL Server (local SQL Server, SQL Express, Docker SQL Server, or Azure SQL).
- Azure CLI for infrastructure deployment.

## 5. Required Configuration

Create `.env` from `.env.example` at repository root:

```bash
copy .env.example .env
```

At minimum, set:

- SQL values (`InvoiceLens__Sql__*`).
- OpenInvoice values (`OpenInvoice__*`) for mock or real endpoint mode.
- Auth values (`InvoiceLens__Auth__*`) for Microsoft sign-in.

## 6. Local SQL Server Setup

Use one supported host pattern:

- `localhost,1433` (local or Docker SQL)
- `localhost\SQLEXPRESS` (SQL Express)
- `<server>.database.windows.net` (Azure SQL)

Required keys:

```bash
InvoiceLens__Sql__ServerHost=
InvoiceLens__Sql__DatabaseName=InvoiceLens
InvoiceLens__Sql__Username=
InvoiceLens__Sql__Password=
InvoiceLens__Sql__Encrypt=
InvoiceLens__Sql__TrustServerCertificate=
```

Initialize schema/scripts as needed from `database/migrations` and `database/scripts`.

## 7. How To Run OpenInvoiceMock

```bash
dotnet run --project src/InvoiceLens.OpenInvoiceMock
```

Health endpoint:

- `http://localhost:5189/health` (when running on the default local profile/port)

## 8. How To Run API

```bash
dotnet run --project src/InvoiceLens.Api
```

Health endpoint:

- `/health`

Startup behavior:

- API loads root `.env`.
- API builds SQL connection string from `InvoiceLens__Sql__*` values.
- API fails fast if SQL is unreachable.

## 9. How To Run Worker

```bash
dotnet run --project src/InvoiceLens.Worker
```

Worker runs recurring hosted jobs for:

- Invoice list sync
- Invoice detail sync
- Attachment/snapshot sync
- Event post and retry
- Local invoice load/optional auto-compare

## 10. How To Run Web App

```bash
cd apps/web
npm install
npm run build
npm run start
```

The web server proxies API calls to `API_BASE_URL` (default `http://localhost:5106`).

## 11. How Runtime Flow Works

1. Browser calls API endpoints only.
2. API reads/writes SQL-backed invoice, queue, validation, and audit data.
3. Worker syncs upstream OpenInvoice data into SQL.
4. UI reflects SQL-backed operational state.

## 12. How OpenInvoice Sync Works

1. Worker requests invoice list from OpenInvoice-style endpoints.
2. Worker fetches invoice details, attachments, and snapshot documents.
3. Worker stores raw upstream payloads and hashes.
4. Worker maps normalized snapshots into SQL tables.
5. Worker posts queued outbox events and retries failures.

## 13. How Local Invoice Comparison Works

This feature has been removed from the current UI and default deployment path.
The app now focuses on the Dashboard, Invoices, Analytics, Contracts, Vendors, Reports, Notifications, Help, and Admin screens.

## 14. Azure Deployment Overview

Infrastructure is currently defined in `infra/bicep/main.bicep` with environment parameter files:

- `infra/bicep/parameters/dev.bicepparam`
- `infra/bicep/parameters/test.bicepparam`
- `infra/bicep/parameters/prod.bicepparam`

Current template coverage includes:

- Resource group
- ACR
- Managed identity
- Key Vault
- Azure SQL Server + Database
- Log Analytics
- Application Insights
- App Service plan
- API and Web App Service deployment path
- Optional API/Web Container Apps path
- The default deployment path now targets only the backend API App Service and the frontend Web App Service.

## 15. How To Deploy Infrastructure (Current Bicep)

PowerShell scripts:

- `infra/bicep/scripts/deploy-dev.ps1`
- `infra/bicep/scripts/deploy-test.ps1`
- `infra/bicep/scripts/deploy-prod.ps1`

Manual equivalent command pattern:

```bash
az deployment sub create \
  --name invoicelens-<env>-infra \
  --location <location> \
  --template-file infra/bicep/main.bicep \
  --parameters infra/bicep/parameters/<env>.bicepparam
```

If ARM JSON is required for review/tooling, compile from existing Bicep:

```bash
az bicep build --file infra/bicep/main.bicep
```

### Optional .env Naming Overrides For Infra

The deployment scripts in `infra/bicep/scripts` now read optional values from the repository root `.env` file.

Use these keys to change naming and regions without editing bicep parameter files:

- `INVOICELENS_INFRA_RESOURCE_PREFIX`
- `INVOICELENS_INFRA_DEV_DEPLOYMENT_NAME`
- `INVOICELENS_INFRA_TEST_DEPLOYMENT_NAME`
- `INVOICELENS_INFRA_PROD_DEPLOYMENT_NAME`
- `INVOICELENS_INFRA_DEV_LOCATION`
- `INVOICELENS_INFRA_TEST_LOCATION`
- `INVOICELENS_INFRA_PROD_LOCATION`
- `INVOICELENS_INFRA_DEV_SQL_LOCATION`
- `INVOICELENS_INFRA_TEST_SQL_LOCATION`
- `INVOICELENS_INFRA_PROD_SQL_LOCATION`

Optional SQL admin overrides for script-driven deployment:

- `INVOICELENS_INFRA_SQL_ADMIN_LOGIN`
- `INVOICELENS_INFRA_SQL_ADMIN_PASSWORD`

## 16. How To Deploy API

Current pipeline file `pipelines/deploy-api.yml` is a placeholder.

Recommended current path:

1. Build and push the API container image to the ACR created by Bicep.
2. Run the app deployment script to update the backend App Service.
3. Configure required app settings for SQL/Auth/monitoring.

For dev environments after infra is created, use:

```bash
pwsh ./infra/bicep/scripts/deploy-app-dev.ps1
```

That script updates the backend and frontend App Service container images.

## 18. How To Deploy Web App

Current pipeline file `pipelines/deploy-web.yml` is a placeholder.

Recommended current path:

1. Build and push web image to ACR.
2. Update the Web App Service image.
3. Set `InvoiceLens__Auth__*` values for runtime auth configuration.

The dev deployment script reads image tags from `.env`:

- `INVOICELENS_API_IMAGE`
- `INVOICELENS_WEB_IMAGE`

## 19. Environment Differences (Dev, Test, Prod)

- `dev`: backend and frontend App Services deployed for local integration-style testing.
- `test`: backend and frontend App Services deployed for controlled non-prod testing.
- `prod`: backend and frontend App Services deployed.
- SQL, auth redirect URIs, image tags, and secret values differ by environment.

## 20. Troubleshooting

### SQL connection timeout

- Verify SQL host/port and firewall.
- Check `InvoiceLens__Sql__ServerHost` and encryption settings.

### Missing database

- Create `InvoiceLens` database and run schema scripts/migrations.

### Wrong connection string behavior

- Confirm `InvoiceLens__Sql__*` keys are loaded from root `.env`.
- Check for conflicting environment variables at process level.

### Azure SQL firewall issue

- Allow client IP or VNet path for the API hosting resource.

### App settings not loaded

- Confirm settings were applied on the actual deployed resource (API/Web).
- Restart app after settings changes.

### Frontend cannot reach API

- Confirm `API_BASE_URL` and API local port.
- Check CORS/proxy behavior from web server.

### Authentication errors

- Validate Entra app registration values in `InvoiceLens__Auth__*`.
- Confirm redirect URIs exactly match deployed web URL.

### Missing secrets

- Populate SQL/OpenInvoice/Auth settings in app settings or Key Vault integration workflow.

### Failed Azure deployment

- Validate secure parameter values in `.bicepparam` files.
- Check subscription scope permissions and deployment location.

## 21. Common Startup Issues

- API starts then exits: SQL unreachable at startup.
- API returns 401 in UI: session not established or auth config missing.
- Background sync path does no useful work when enabled: OpenInvoice base URL/HMAC mismatch.
- Web starts but blank/locked UX: missing runtime auth values.

## 22. Next Development Steps

1. Implement concrete `deploy-api.yml` and `deploy-web.yml` steps.
2. Add explicit SQL readiness health endpoints (`/health/sql`).
3. Add automated migration execution in deployment workflow.
4. Add first test projects in existing `tests/*` placeholders.

## Local Startup Order

Use this order for local development:

1. Start SQL Server.
2. Confirm the `InvoiceLens` database exists.
3. Configure root `.env`.
4. Start `InvoiceLens.Api`.
5. Start `apps/web`.

The API requires SQL connectivity.

## Azure Deployment Sequence (Step-by-Step)

This section is the recommended deployment playbook with copy/paste commands.

### 1. Prerequisites

Install and verify:

- Azure CLI
- Docker Desktop (for image build/push)
- PowerShell 7+

```powershell
az --version
docker --version
pwsh --version
```

### 2. Configure Environment File

Create and update root .env:

```powershell
copy .env.example .env
```

Set at least these keys in .env:

- INVOICELENS_INFRA_RESOURCE_PREFIX
- INVOICELENS_INFRA_ENVIRONMENT
- INVOICELENS_API_IMAGE
- INVOICELENS_WEB_IMAGE
- INVOICELENS_OPENINVOICEMOCK_IMAGE
- INVOICELENS_WORKER_IMAGE
- InvoiceLens__Auth__ClientId
- InvoiceLens__Auth__TenantId
- InvoiceLens__Auth__RedirectUri
- InvoiceLens__Auth__PostLogoutRedirectUri
- INVOICELENS_INFRA_SQL_ADMIN_LOGIN
- INVOICELENS_INFRA_SQL_ADMIN_PASSWORD

### 3. Login and Select Subscription

```powershell
az login
az account set --subscription <subscription-id-or-name>
az account show --query "{name:name,id:id}" -o table
```

### 4. Deploy Infrastructure

Choose one environment script:

```powershell
pwsh ./infra/bicep/scripts/deploy-dev.ps1
pwsh ./infra/bicep/scripts/deploy-test.ps1
pwsh ./infra/bicep/scripts/deploy-prod.ps1
```

Manual equivalent (if needed):

```powershell
az deployment sub create --name invoicelens-<env>-infra --location <location> --template-file infra/bicep/main.bicep --parameters infra/bicep/parameters/<env>.bicepparam
```

### 5. Build and Push Container Images to ACR

The fastest path is ACR Tasks using az acr build.

1) Set deployment variables:

```powershell
$EnvName = "dev"
$Prefix = "invoicelensx"
$ResourceGroup = "$Prefix-$EnvName-rg"
$AcrName = az acr list --resource-group $ResourceGroup --query "[0].name" -o tsv
$AcrLoginServer = az acr show --name $AcrName --query loginServer -o tsv
```

2) Build images in ACR:

```powershell
az acr build --registry $AcrName --image invoicelens-api:$EnvName --file src/InvoiceLens.Api/Dockerfile .
az acr build --registry $AcrName --image invoicelens-web:$EnvName --file apps/web/Dockerfile .
az acr build --registry $AcrName --image invoicelens-openinvoicemock:$EnvName --file src/InvoiceLens.OpenInvoiceMock/Dockerfile .
az acr build --registry $AcrName --image invoicelens-worker:$EnvName --file src/InvoiceLens.Worker/Dockerfile .
```

If your .env uses custom tags, build with those exact tags.

### 6. Deploy App Containers (API and Web)

For dev, use the repository script (reads .env and updates app images):

```powershell
pwsh ./infra/bicep/scripts/deploy-app-dev.ps1
```

This script updates:

- API App Service container image
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
