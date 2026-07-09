# InvoiceLens Deployment Runbook (Minimal Commands)

This runbook is the single path to deploy without long command chains.

## 1) Files Used In Deployment

- `infra/bicep/scripts/deploy-dev.ps1` (infra)
- `infra/bicep/scripts/deploy-app-dev.ps1` (apply app images to Azure Web Apps)
- `infra/bicep/main.bicep` (infra template)
- `infra/bicep/parameters/dev.bicepparam` (dev parameters)
- `src/InvoiceLens.Api/Dockerfile` (API image)
- `apps/web/Dockerfile` (Web image)
- `src/InvoiceLens.OpenInvoiceMock/Dockerfile` (OpenInvoiceMock image)

## 2) Required One-Time Setup

Run from repository root (`C:\Users\Home\Desktop\InvoiceLens`):

```powershell
az login
az account set --subscription <your-subscription-id-or-name>
```

## 3) Standard Dev Deployment (Copy/Paste)

Run from repository root:

```powershell
.\infra\bicep\scripts\deploy-all-dev.ps1
```

That single command performs:

- Infra pre-check (resource group + required resources)
- Skip infra if everything already exists
- Reconcile missing infra resources if anything is missing
- Build and push images
- Deploy app images to Azure
- Endpoint verification

If you need the expanded steps, use the sequence below.

```powershell
# 1) Deploy infrastructure
.\infra\bicep\scripts\deploy-dev.ps1

# 2) Resolve ACR name
$rg = 'invoicelensx-dev-rg'
$acr = az acr list --resource-group $rg --query "[0].name" -o tsv

# 3) Build and push images
az acr build --registry $acr --image invoicelens-api:dev --file src/InvoiceLens.Api/Dockerfile .
az acr build --registry $acr --image invoicelens-web:dev --file apps/web/Dockerfile apps/web
az acr build --registry $acr --image invoicelens-openinvoicemock:dev --file src/InvoiceLens.OpenInvoiceMock/Dockerfile .

# 4) Update Azure apps to new images
.\infra\bicep\scripts\deploy-app-dev.ps1

# 5) Verify
az webapp list --resource-group $rg --query "[].{name:name,state:state,host:defaultHostName}" -o table
Invoke-WebRequest -Uri 'https://invoicelensx-dev-api.azurewebsites.net/health' -UseBasicParsing | Select-Object -ExpandProperty StatusCode
Invoke-WebRequest -Uri 'https://invoicelensx-dev-web.azurewebsites.net' -UseBasicParsing | Select-Object -ExpandProperty StatusCode
```

## 4) What Is Already Fixed For Future Deployments

`deploy-app-dev.ps1` now includes guards for the exact failures we hit:

- Validates image exists in ACR before attempting app update.
- Forces Web Apps to use registry credentials (turns off managed identity image pull mode).
- Restarts updated apps automatically.
- Prints API and Web URLs after deployment.

This avoids silent 503 loops from `ImagePullUnauthorizedFailure` when managed identity pull mode is active.

## 5) If Key Vault Name Conflicts Again

If infra deployment fails with Key Vault deleted-state conflict:

```powershell
az keyvault recover --name invoicelensx-dev-kv
# OR purge if you intentionally want a clean recreation:
az keyvault purge --name invoicelensx-dev-kv --location eastus
```

Then rerun:

```powershell
.\infra\bicep\scripts\deploy-dev.ps1
```

## 6) One-Command Cleanup + Redeploy Pattern

```powershell
az group delete --name invoicelensx-dev-rg --yes --no-wait
# wait for deletion to complete, then:
az keyvault purge --name invoicelensx-dev-kv --location eastus
.\infra\bicep\scripts\deploy-dev.ps1
```

## 7) Important Shell Note (Windows)

In this environment, call scripts directly:

```powershell
.\infra\bicep\scripts\deploy-dev.ps1
```

Do not depend on `pwsh` being present in PATH.
