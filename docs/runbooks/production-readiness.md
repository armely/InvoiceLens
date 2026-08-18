# InvoiceLens Production Readiness

## Runtime Topology

- Run one API container instance. The API owns the recurring OpenInvoice synchronization; do not deploy the legacy Worker beside it.
- Run the web container separately and route `/api` to the API over HTTPS.
- Keep OpenInvoiceMock out of production.
- Enable platform `Always On` and health probes for both services.

## Required Configuration

- Store the SQL password, Microsoft authentication settings, OpenInvoice HMAC key, certificate password, and notification credentials in Key Vault references.
- Set `OpenInvoice__UseMock=false` and `OpenInvoice__BaseUrl` to the production endpoint.
- Set `OpenInvoice__SyncLookbackDays` to the approved reconciliation horizon. The default is 3650 days and every run queries from that UTC boundary through the current UTC instant.
- Set `OpenInvoice__StoragePath` to durable mounted storage. For Azure App Service use a path under `/home`, for example `/home/data/OpenInvoiceStorage`; do not rely on the container image filesystem.
- Set `AllowedHosts` to the actual API host names instead of `*`.
- Keep `SyncSchedule__IncrementalSyncMinutes` at 5 minutes or greater. The job retries failures after 30 seconds and performs differential database/file repairs.

## Deployment Gates

1. Replace the placeholder `pipelines/deploy-api.yml` and `pipelines/deploy-web.yml` tasks with authenticated image deployment stages, approvals, and rollback steps.
2. Run database migrations before switching application traffic. Back up Azure SQL and test restore procedures.
3. Build immutable Release images, scan them, pin deployed image digests, and promote the same digest through test and production.
4. Verify `/health`, authenticated invoice list/detail flows, attachment download, multi-PDF preview, and the designed fallback after deployment.
5. Confirm only one API instance is running until a SQL-backed distributed sync lock is implemented.

## Operations

- Alert when the latest `OpenInvoiceSyncRuns` entry is failed, completed with errors, or older than twice the configured interval.
- Alert on repeated HTTP 401/403/429/5xx responses, SQL connectivity failures, storage write failures, and event outbox backlog.
- Retain structured logs with correlation IDs and avoid logging invoice bodies, credentials, or attachment contents.
- Monitor durable storage capacity and clean raw-document history using an agreed retention policy.
- Exercise certificate and HMAC-key rotation before launch.

## Remaining Improvements

- Add a database application lock around the sync run before allowing API scale-out.
- Add a readiness endpoint that verifies SQL connectivity, writable durable storage, and recent successful synchronization; keep `/health` as the lightweight liveness endpoint.
- Replace local attachment storage with Azure Blob Storage when horizontal scale or regional failover is required.
- Add integration tests against a production-contract OpenInvoice sandbox, including paging, rate limiting, malformed documents, duplicate invoices, deleted attachments, and clock-boundary cases.
- Add automated retention for `OpenInvoiceRawDocuments`, sync runs, audit entries, and failed outbox events.
