# InvoiceLens Cleanup Report

Date: 2026-07-07

## Scope

This cleanup pass was performed inside the existing repository structure without redesigning architecture or moving projects.

## Removed Folders

The following generated/local artifact folders were targeted for removal because they are build/runtime outputs and not source-of-truth files:

- `.tmp-npm-cache`
- `src/InvoiceLens.Api/bin`
- `src/InvoiceLens.Api/obj`
- `src/InvoiceLens.Api/.tmp-obj`
- `src/InvoiceLens.Api/.tmp-out`
- `src/InvoiceLens.Application/bin`
- `src/InvoiceLens.Application/obj`
- `src/InvoiceLens.Application/.tmp-obj`
- `src/InvoiceLens.Application/.tmp-out`
- `src/InvoiceLens.Domain/bin`
- `src/InvoiceLens.Domain/obj`
- `src/InvoiceLens.Domain/.tmp-obj`
- `src/InvoiceLens.Domain/.tmp-out`
- `src/InvoiceLens.Infrastructure/bin`
- `src/InvoiceLens.Infrastructure/obj`
- `src/InvoiceLens.Infrastructure/.tmp-obj`
- `src/InvoiceLens.Infrastructure/.tmp-out`
- `src/InvoiceLens.OpenInvoiceMock/bin`
- `src/InvoiceLens.OpenInvoiceMock/obj`
- `src/InvoiceLens.Worker/bin`
- `src/InvoiceLens.Worker/obj`

Note: some files under `src/InvoiceLens.Api/bin` were locked by a running process and could not be deleted during this pass.

## Removed Files

No tracked source files were removed.

## Empty Folders Intentionally Kept

The following empty folders were kept intentionally and now include `.gitkeep` markers:

- `database/seed/.gitkeep`
- `tests/InvoiceLens.ContractTests/.gitkeep`
- `tests/InvoiceLens.E2ETests/.gitkeep`
- `tests/InvoiceLens.IntegrationTests/.gitkeep`
- `tests/InvoiceLens.UnitTests/.gitkeep`
- `src/InvoiceLens.Application/Users/.gitkeep`
- `src/InvoiceLens.Domain/Events/.gitkeep`
- `src/InvoiceLens.Domain/Rules/.gitkeep`
- `src/InvoiceLens.Domain/ValueObjects/.gitkeep`
- `src/InvoiceLens.Infrastructure/ExternalServices/.gitkeep`
- `src/InvoiceLens.Infrastructure/KeyVault/.gitkeep`
- `src/InvoiceLens.Infrastructure/Logging/.gitkeep`

Reason: these folders appear to be intended extension points/placeholders for planned implementation and test structure.

## Deployment Files Reviewed

Reviewed existing infrastructure and deployment files:

- `infra/bicep/main.bicep`
- `infra/bicep/modules/*`
- `infra/bicep/parameters/dev.bicepparam`
- `infra/bicep/parameters/test.bicepparam`
- `infra/bicep/parameters/prod.bicepparam`
- `infra/bicep/scripts/compile-bicep.ps1`
- `infra/bicep/scripts/deploy-dev.ps1`
- `infra/bicep/scripts/deploy-test.ps1`
- `infra/bicep/scripts/deploy-prod.ps1`
- `pipelines/deploy-infra.yml`
- `pipelines/deploy-api.yml`
- `pipelines/deploy-worker.yml`
- `pipelines/deploy-web.yml`
- `pipelines/deploy-app.yml`

## Deployment Cleanup/Alignment Changes

`infra/bicep/main.bicep` and parameter files were updated to reduce deployment ambiguity:

- Added explicit deployment-mode flags to avoid deploying duplicate API/Web hosting targets by default.
- Kept App Service path as default for API/Web.
- Kept Worker as Container App Job.
- Added optional OpenInvoiceMock deployment path for dev/test.

## Files Reviewed But Kept

- `infra/bicep/modules/container-apps.bicep`
- `infra/bicep/modules/sql.bicep`

Reason: not currently referenced by `main.bicep`, but retained as potentially intentional composition modules.

- `src/InvoiceLens.Api/Dockerfile`
- `src/InvoiceLens.Worker/Dockerfile`

Reason: currently empty, but kept because they are valid expected deployment artifact paths and may be completed in subsequent work.

## Uncertain Items Not Removed

- `.agents/`

Reason: empty folder in current workspace; uncertain whether local tooling depends on it.

## Safety Notes

- No application boundary changes were made.
- No `.sln` project membership was changed.
- No controller/service source logic was removed.
- Existing user-edited files already dirty in the working tree were not modified in this cleanup pass.
