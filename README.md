# Target Repository Structure

This is the final clean repository structure for InvoiceLens.

It uses Angular and .NET only for the main product. Python, Java, and Node.js are not part of the core backend.

## Target folder tree

```text
InvoiceLens/
  README.md
  .gitignore
  .editorconfig
  global.json
  Directory.Build.props
  InvoiceLens.sln

  docs/
    architecture/
      target-architecture.md
      openinvoice-api-flow.md
      sync-flow.md
      security-model.md
    requirements/
      functional-requirements.md
      non-functional-requirements.md
      user-roles.md
    runbooks/
      deployment-runbook.md
      sync-runbook.md
      incident-runbook.md

  apps/
    web/
      angular.json
      package.json
      tsconfig.json
      src/
        app/
          core/
          shared/
          features/
            dashboard/
            invoices/
            compliance-queue/
            invoice-viewer/
            validation-summary/
            admin/
        assets/
        environments/
      Dockerfile
      nginx.conf

  src/
    InvoiceLens.Api/
      Controllers/
      Middleware/
      Auth/
      Program.cs
      appsettings.json
      Dockerfile

    InvoiceLens.Application/
      Invoices/
      ComplianceQueue/
      Validation/
      Sync/
      Users/
      Common/

    InvoiceLens.Domain/
      Entities/
      ValueObjects/
      Enums/
      Events/
      Rules/

    InvoiceLens.Infrastructure/
      Persistence/
      OpenInvoice/
      KeyVault/
      DocumentStreaming/
      Logging/
      ExternalServices/

    InvoiceLens.Worker/
      Jobs/
      Schedules/
      SyncHandlers/
      Program.cs
      appsettings.json
      Dockerfile

  database/
    migrations/
    seed/
    scripts/
      create-schema.sql
      create-indexes.sql
      seed-local-data.sql

  infra/
    bicep/
      main.bicep
      parameters/
        dev.bicepparam
        test.bicepparam
        prod.bicepparam
      modules/
        acr.bicep
        app-insights.bicep
        container-apps.bicep
        key-vault.bicep
        managed-identity.bicep
        sql.bicep
        role-assignments.bicep

  tests/
    InvoiceLens.UnitTests/
    InvoiceLens.IntegrationTests/
    InvoiceLens.ContractTests/
    InvoiceLens.E2ETests/

  pipelines/
    azure-pipelines.yml
    build-api.yml
    build-web.yml
    deploy-infra.yml
    deploy-app.yml
```

## Responsibility split

| Folder | Purpose |
|---|---|
| `apps/web` | Angular UI only |
| `src/InvoiceLens.Api` | REST API for frontend requests |
| `src/InvoiceLens.Application` | Business use cases and orchestration |
| `src/InvoiceLens.Domain` | Core business objects and rules |
| `src/InvoiceLens.Infrastructure` | SQL, OpenInvoice, Key Vault, streaming |
| `src/InvoiceLens.Worker` | Scheduled sync jobs and background processing |
| `infra/bicep` | Azure infrastructure as code |
| `database` | SQL schema, migrations, indexes, seed data |
| `tests` | Unit, integration, contract, and E2E tests |

## Key design rule

Angular talks only to `InvoiceLens.Api`.

`InvoiceLens.Api` and `InvoiceLens.Worker` are the only components allowed to call OpenInvoice.

OpenInvoice secrets, certificates, HMAC keys, and access tokens never reach the browser.


---

# Phase 0: Discovery and Current State

## Objective

Understand the existing InvoiceLens environment before changing code.

This phase protects the current live customer workflow.

## Main outcome

A clear baseline of the current system, API calls, data fields, deployment process, and risks.

## Phase folder structure

```text
InvoiceLens/
  docs/
    discovery/
      current-state-summary.md
      current-deployment-notes.md
      current-api-inventory.md
      current-database-inventory.md
      current-risk-register.md
      openinvoice-sample-requests.md
      openinvoice-sample-responses.md
    diagrams/
      current-architecture.png
      current-sync-flow.png
```

## What to document

| Area | What to capture |
|---|---|
| Current UI | Screens, filters, search behavior, attachment opening |
| Current APIs | Java data API, .NET attachment API, endpoints, ports |
| Current database | Invoice tables, searchable columns, indexes |
| Current OpenInvoice calls | Invoice list, invoice details, attachments, snapshot |
| Current deployment | IIS, Task Scheduler, URL rewrite, startup tasks |
| Current security | Certificates, sessions, HMAC, IP restrictions |
| Current risks | Service restarts, split codebase, secrets, manual support |

## Deliverables

- Current state architecture diagram
- API inventory
- Database inventory
- Deployment inventory
- Risk register
- Sample request and response catalog

## Exit criteria

- We know what the current app does.
- We know what must not break.
- We know which calls must be rebuilt in .NET.
- We have enough sample data to build the facelift safely.


---

# Phase 1: UI Facelift

## Objective

Refresh the user experience without changing the production backend.

This phase creates the new InvoiceLens workspace look using Angular and mock data first.

## Main outcome

A cleaner operational interface with search, queue, invoice viewer, and validation summary screens.

## Phase folder structure

```text
InvoiceLens/
  apps/
    web/
      src/
        app/
          core/
            auth/
            http/
            layout/
            guards/
          shared/
            components/
              status-chip/
              page-header/
              filter-bar/
              empty-state/
              loading-state/
            models/
            pipes/
          features/
            dashboard/
            invoices/
              invoice-search/
              invoice-results-table/
              invoice-detail-shell/
            compliance-queue/
              queue-list/
              queue-filters/
            invoice-viewer/
              document-viewer/
              document-toolbar/
            validation-summary/
              validation-checklist/
              variance-card/
            admin/
          mock-data/
            invoices.mock.ts
            queue.mock.ts
            validation.mock.ts
        assets/
          images/
          icons/
        environments/
      Dockerfile
      nginx.conf
```

## Screens to build

| Screen | Purpose |
|---|---|
| Dashboard | Overview of volume, queue, exceptions, and recent activity |
| Invoice Search | Search by invoice ID, invoice number, vendor, AFE, company |
| Compliance Queue | Show invoices needing review |
| Invoice Review | Show document viewer and validation summary |
| Admin Settings | Manage mappings and reference data later |

## Angular modules or feature areas

- `dashboard`
- `invoices`
- `compliance-queue`
- `invoice-viewer`
- `validation-summary`
- `admin`

## Rules for this phase

- Use mock data first.
- Do not call OpenInvoice from Angular.
- Do not expose credentials in the browser.
- Do not change the live IIS setup yet.
- Keep the UI simple and readable.

## Exit criteria

- The new UI is approved visually.
- The main user workflow is clear.
- The frontend can later connect to the .NET API with minimal rework.


---

# Phase 2: .NET Backend Consolidation

## Objective

Replace the split backend model with one ASP.NET Core backend.

The target is one clean API that handles data search, invoice details, document streaming, validation, audit logging, and OpenInvoice integration.

## Main outcome

Angular calls one backend only: `InvoiceLens.Api`.

## Phase folder structure

```text
InvoiceLens/
  src/
    InvoiceLens.Api/
      Controllers/
        InvoicesController.cs
        DocumentsController.cs
        ValidationController.cs
        QueueController.cs
        SyncController.cs
        AdminController.cs
      Middleware/
        ExceptionHandlingMiddleware.cs
        CorrelationIdMiddleware.cs
      Auth/
        CurrentUser.cs
        RolePolicies.cs
      Program.cs
      appsettings.json
      Dockerfile

    InvoiceLens.Application/
      Invoices/
        SearchInvoicesQuery.cs
        GetInvoiceDetailQuery.cs
        GetInvoiceReviewModelQuery.cs
      Documents/
        StreamInvoiceSnapshotQuery.cs
        StreamInvoiceAttachmentQuery.cs
      ComplianceQueue/
        GetQueueItemsQuery.cs
        UpdateQueueStatusCommand.cs
      Validation/
        RunValidationCommand.cs
        GetValidationSummaryQuery.cs
      Common/
        Result.cs
        PagedResult.cs

    InvoiceLens.Domain/
      Entities/
        Invoice.cs
        InvoiceLine.cs
        Vendor.cs
        Afe.cs
        CostCenter.cs
        ValidationResult.cs
        AuditEntry.cs
      Enums/
        InvoiceStatus.cs
        ValidationSeverity.cs
        QueueStatus.cs
      Rules/
        VendorMatchRule.cs
        AfeMatchRule.cs
        CostCenterRule.cs
        CurrencyRule.cs

    InvoiceLens.Infrastructure/
      Persistence/
        InvoiceLensDbContext.cs
        Repositories/
      OpenInvoice/
        IOpenInvoiceClient.cs
        OpenInvoiceClient.cs
        OpenInvoiceOptions.cs
        OpenInvoiceAuthHandler.cs
      DocumentStreaming/
        DocumentStreamService.cs
      KeyVault/
        SecretProvider.cs
      Logging/
        AuditLogger.cs
```

## Internal API endpoints

```text
GET  /api/invoices
GET  /api/invoices/{invoiceId}
GET  /api/invoices/{invoiceId}/review
GET  /api/invoices/{invoiceId}/snapshot
GET  /api/invoices/{invoiceId}/attachments/{attachmentId}
GET  /api/queue
POST /api/invoices/{invoiceId}/validate
POST /api/invoices/{invoiceId}/approve
POST /api/invoices/{invoiceId}/send-back
GET  /api/sync/status
```

## Backend rules

- The browser never calls OpenInvoice directly.
- All OpenInvoice calls go through `OpenInvoiceClient`.
- Attachment and snapshot streaming stay inside .NET.
- SQL access stays inside the infrastructure layer.
- Business rules stay inside the application and domain layers.

## Exit criteria

- The old Java data API has a .NET replacement.
- The old .NET attachment proxy is merged into the main .NET backend.
- Angular can call one backend API.
- Local development can run with mock OpenInvoice responses.


---

# Phase 3: OpenInvoice Sync

## Objective

Keep SQL metadata in sync with OpenInvoice.

SQL is the searchable operational index. OpenInvoice remains the source of truth.

## Main outcome

A .NET Worker pulls invoice metadata from OpenInvoice, upserts SQL, logs errors, and supports reconciliation.

## Phase folder structure

```text
InvoiceLens/
  src/
    InvoiceLens.Worker/
      Jobs/
        InitialInvoiceHydrationJob.cs
        IncrementalInvoiceSyncJob.cs
        ReconciliationJob.cs
        FailedRecordRetryJob.cs
      Schedules/
        SyncScheduleOptions.cs
      SyncHandlers/
        InvoiceListSyncHandler.cs
        InvoiceDetailSyncHandler.cs
        InvoiceUpsertHandler.cs
        SyncCheckpointHandler.cs
      Program.cs
      appsettings.json
      Dockerfile

    InvoiceLens.Application/
      Sync/
        RunInitialHydrationCommand.cs
        RunIncrementalSyncCommand.cs
        RunReconciliationCommand.cs
        RetryFailedSyncRecordsCommand.cs

    InvoiceLens.Infrastructure/
      OpenInvoice/
        InvoiceListResponseParser.cs
        InvoiceDetailXmlParser.cs
        OpenInvoicePagingService.cs
      Persistence/
        SyncCheckpointRepository.cs
        SyncErrorRepository.cs

  database/
    migrations/
      001_create_invoice_tables.sql
      002_create_sync_tables.sql
      003_create_invoice_indexes.sql
    scripts/
      upsert-invoice.sql
      reconcile-invoices.sql
```

## SQL tables

```text
Invoice
InvoiceLine
InvoiceAttachmentReference
InvoiceActionHistory
Vendor
Afe
CostCenter
SyncCheckpoint
SyncBatch
SyncError
ReconciliationResult
```

## Sync flow

```text
OpenInvoice API
  -> .NET Worker
  -> Parse list response
  -> Fetch invoice details where needed
  -> Upsert Azure SQL
  -> Save checkpoint
  -> Log errors
  -> Reconcile counts and totals
```

## Sync types

| Sync type | Purpose |
|---|---|
| Initial hydration | Pull first 30 days or agreed range |
| Incremental sync | Pull new and changed invoices hourly |
| Detail refresh | Pull details for selected or changed invoices |
| Reconciliation | Compare OpenInvoice and SQL counts, totals, status |
| Retry | Reprocess failed records |

## Exit criteria

- SQL can be populated from OpenInvoice metadata.
- Upsert logic prevents duplicate invoice records.
- Sync checkpoints are stored.
- Failed invoices are logged and retryable.
- The UI can search SQL without live OpenInvoice calls for every search.


---

# Phase 4: Validation and Audit

## Objective

Add operational compliance checks to InvoiceLens.

The system should highlight issues before approval or ERP push.

## Main outcome

Each invoice review page shows validation results, exceptions, and a permanent audit trail.

## Phase folder structure

```text
InvoiceLens/
  src/
    InvoiceLens.Application/
      Validation/
        RunInvoiceValidationCommand.cs
        GetValidationSummaryQuery.cs
        ValidationOrchestrator.cs
        Rules/
          VendorMatchValidation.cs
          AfeValidation.cs
          CostCenterValidation.cs
          CurrencyValidation.cs
          AmountVarianceValidation.cs
          MsaRateValidation.cs
      Audit/
        CreateAuditEntryCommand.cs
        GetAuditTrailQuery.cs
        AuditEventFactory.cs

    InvoiceLens.Domain/
      Entities/
        ValidationResult.cs
        ValidationRule.cs
        MsaContract.cs
        AuditEntry.cs
      Enums/
        ValidationStatus.cs
        ValidationSeverity.cs
        AuditActionType.cs

    InvoiceLens.Infrastructure/
      Persistence/
        Repositories/
          ValidationRepository.cs
          AuditRepository.cs
          MsaContractRepository.cs

  apps/
    web/
      src/
        app/
          features/
            validation-summary/
              validation-checklist/
              validation-detail-drawer/
              rate-variance-card/
            invoice-viewer/
              approval-actions/
            admin/
              msa-contracts/

  database/
    migrations/
      004_create_validation_tables.sql
      005_create_audit_tables.sql
      006_create_msa_contract_tables.sql
```

## Validation checks

| Check | Purpose |
|---|---|
| Vendor match | Confirm supplier matches approved vendor master |
| AFE match | Confirm invoice AFE exists and is active |
| Cost center | Confirm cost center exists and is valid |
| Currency | Confirm invoice currency matches expected coding or agreement |
| Amount variance | Detect abnormal invoice amount changes |
| MSA rate | Compare line item rate against contract cap |

## Audit actions

```text
Invoice viewed
Validation executed
Exception detected
Approved
Sent back
Comment added
Document downloaded
ERP push requested
```

## Exit criteria

- Validation summary appears on the review page.
- Exceptions are stored in SQL.
- Approve and send-back actions write audit entries.
- MSA contract checks can detect rate variance.
- Audit trail can be reviewed by invoice.


---

# Phase 5: Azure Bicep Deployment

## Objective

Deploy InvoiceLens using repeatable infrastructure as code.

Bicep is the source of truth for Azure resources.

## Main outcome

A consistent dev, test, and production deployment model.

## Phase folder structure

```text
InvoiceLens/
  infra/
    bicep/
      main.bicep
      parameters/
        dev.bicepparam
        test.bicepparam
        prod.bicepparam
      modules/
        resource-group.bicep
        acr.bicep
        managed-identity.bicep
        key-vault.bicep
        sql-server.bicep
        sql-database.bicep
        app-insights.bicep
        log-analytics.bicep
        app-service-plan.bicep
        api-app-service.bicep
        web-app-service.bicep
        worker-container-job.bicep
        container-apps-environment.bicep
        container-app-api.bicep
        container-app-web.bicep
        role-assignments.bicep
      scripts/
        deploy-dev.ps1
        deploy-test.ps1
        deploy-prod.ps1
        compile-bicep.ps1

  pipelines/
    deploy-infra.yml
    deploy-api.yml
    deploy-web.yml
    deploy-worker.yml
```

## Azure resources

| Resource | Purpose |
|---|---|
| Azure SQL | Invoice metadata, queue, validation, audit |
| Azure Key Vault | OpenInvoice certificate, HMAC key, secrets |
| Managed Identity | Secure access to Key Vault and registry |
| Azure App Service or Container Apps | Host UI and API |
| Container App Job or Worker | Run scheduled sync |
| Application Insights | Telemetry and diagnostics |
| Log Analytics | Centralized logs |
| Azure Container Registry | Store built container images |

## Deployment options

### Option A: Simpler start

```text
Angular static app -> Azure App Service or Static Web Apps
ASP.NET Core API -> Azure App Service
.NET Worker -> Azure WebJob, Function, or Container App Job
Azure SQL -> Metadata database
Key Vault -> Secrets
```

### Option B: Productized container deployment

```text
Angular container -> Azure Container Apps
ASP.NET Core API container -> Azure Container Apps
.NET Worker job -> Azure Container Apps Job
Azure SQL -> Metadata database
Key Vault -> Secrets
```

## Exit criteria

- Infrastructure deploys from Bicep.
- No secrets are hardcoded.
- Managed Identity can read Key Vault secrets.
- App settings are environment-specific.
- The same pattern works for dev, test, and production.


---

# Phase 6: QA, Release, and Operations

## Objective

Make InvoiceLens production-ready.

This phase focuses on testing, release control, monitoring, support, and operational runbooks.

## Main outcome

A stable release process and support model.

## Phase folder structure

```text
InvoiceLens/
  tests/
    InvoiceLens.UnitTests/
      Validation/
      Domain/
      Application/
    InvoiceLens.IntegrationTests/
      Api/
      Database/
      OpenInvoiceMock/
    InvoiceLens.ContractTests/
      OpenInvoice/
      ApiContracts/
    InvoiceLens.E2ETests/
      Playwright/
        invoice-search.spec.ts
        invoice-review.spec.ts
        validation-summary.spec.ts

  docs/
    qa/
      test-plan.md
      regression-checklist.md
      uat-script.md
      performance-test-plan.md
    runbooks/
      production-deployment-runbook.md
      sync-failure-runbook.md
      document-streaming-failure-runbook.md
      rollback-runbook.md
      key-rotation-runbook.md
    operations/
      monitoring-dashboard.md
      alert-rules.md
      support-model.md

  pipelines/
    build.yml
    test.yml
    release-dev.yml
    release-test.yml
    release-prod.yml
```

## Test coverage

| Test type | Purpose |
|---|---|
| Unit tests | Validate business rules and domain behavior |
| Integration tests | Validate API, database, Key Vault, and mock OpenInvoice flow |
| Contract tests | Confirm OpenInvoice request and response expectations |
| E2E tests | Test user workflows in the browser |
| Performance tests | Test search, document streaming, and sync load |
| Security tests | Check auth, roles, secrets, and access control |

## Production alerts

```text
OpenInvoice API failures
Document streaming failures
Sync job failures
Sync delay greater than threshold
Validation failure spikes
SQL performance degradation
Unauthorized access attempts
Application error rate increase
```

## Exit criteria

- Test plan is approved.
- UAT is complete.
- Release pipeline is working.
- Monitoring is active.
- Runbooks are available.
- Rollback steps are tested.


---

# Phase 7: Fabric, AI, and Marketplace Future

## Objective

Add advanced product capabilities after the core product is stable.

Do not start here. This phase comes after the .NET backend, sync, validation, and Azure deployment are stable.

## Main outcome

InvoiceLens becomes a stronger analytics and productized offering.

## Phase folder structure

```text
InvoiceLens/
  analytics/
    fabric/
      lakehouse/
      warehouse/
      semantic-model/
      notebooks/
      pipelines/
      powerbi/
        invoice-compliance-dashboard.pbix
        vendor-exceptions-dashboard.pbix

  ai/
    document-intelligence/
      prompts/
      evaluation/
      sample-documents/
    validation-assistant/
      rules-summary.md
      model-evaluation.md
      human-review-policy.md

  marketplace/
    managed-application/
      createUiDefinition.json
      mainTemplate.json
      marketplace-offer-notes.md
      customer-setup-guide.md
    bicep-source/
      main.bicep
      modules/

  docs/
    future/
      fabric-roadmap.md
      ai-validation-roadmap.md
      marketplace-roadmap.md
```

## Fabric use cases

| Use case | Purpose |
|---|---|
| Historical invoice analytics | Trends, volume, aging, vendor patterns |
| Exception analytics | Vendor mismatch, rate variance, missing AFE |
| Power BI dashboards | Operational and executive reporting |
| Semantic model | Reusable reporting layer |

## AI use cases

| Use case | Purpose |
|---|---|
| Invoice field extraction | Read invoice PDFs when XML is incomplete |
| Anomaly explanation | Explain why an invoice was flagged |
| Reviewer assistant | Summarize validation issues for the user |
| Contract comparison | Compare line items against agreement terms |

## Marketplace use cases

| Use case | Purpose |
|---|---|
| Managed deployment | Deploy into customer Azure tenant |
| Customer configuration | Capture tenant, sync settings, and secret references |
| Repeatable onboarding | Faster client rollout |

## Exit criteria

- Core app is stable first.
- Fabric reporting is connected to trusted SQL or curated data.
- AI is assistive, not the approval authority.
- Marketplace packaging uses Bicep source and compiled ARM only when required.


---

# InvoiceLens Project Structure Guide

This folder contains the recommended project structure for InvoiceLens by phase.

The agreed stack is:

- Frontend: Angular with TypeScript
- Backend: ASP.NET Core Web API
- Background processing: .NET Worker Service or Azure Container Apps Job
- Database: SQL Server first, Azure SQL as target
- Infrastructure: Azure Bicep
- Identity: Microsoft Entra ID
- Secrets: Azure Key Vault
- Hosting target: Azure App Service or Azure Container Apps
- Reporting later: Microsoft Fabric

The goal is to move away from the current mixed backend model.

Do not keep one Java API for data and a separate .NET API for attachments as the target design. Use one clean .NET backend layer that owns search, details, document streaming, validation, sync, audit logging, and OpenInvoice integration.

## Phase files

| File | Purpose |
|---|---|
| `00_TARGET_REPOSITORY_STRUCTURE.md` | Final clean target repository layout |
| `01_PHASE_0_DISCOVERY_AND_CURRENT_STATE.md` | Discovery, current state, and migration baseline |
| `02_PHASE_1_UI_FACELIFT.md` | Angular facelift without disrupting production |
| `03_PHASE_2_DOTNET_BACKEND_CONSOLIDATION.md` | Replace split APIs with one ASP.NET Core backend |
| `04_PHASE_3_OPENINVOICE_SYNC.md` | Build metadata sync, SQL upsert, and reconciliation |
| `05_PHASE_4_VALIDATION_AND_AUDIT.md` | Add validation, MSA checks, and audit trail |
| `06_PHASE_5_AZURE_BICEP_DEPLOYMENT.md` | Bicep, Key Vault, Azure SQL, hosting, and identity |
| `07_PHASE_6_QA_RELEASE_AND_OPERATIONS.md` | Testing, CI/CD, monitoring, and production runbook |
| `08_PHASE_7_FABRIC_AI_MARKETPLACE_FUTURE.md` | Future analytics, AI, and marketplace productization |

## Recommended delivery sequence

1. Build the facelift first using mock data.
2. Consolidate backend services into .NET.
3. Add OpenInvoice sync and document streaming.
4. Add validation and audit logging.
5. Deploy with Bicep into Azure.
6. Harden operations, monitoring, and release process.
7. Add Fabric, AI, and Marketplace later.


