# InvoiceLens OpenInvoice API Simulation

This README defines the required implementation for a production-aligned OpenInvoice API simulation layer for InvoiceLens.

The goal is not to create random mock data.

The goal is to create a clean, OpenInvoice-compatible local API that behaves like the real upstream service, so InvoiceLens can be tested end to end before real OpenInvoice Onboard, UAT, or Production access is available.

## Purpose

InvoiceLens currently reads invoice, queue, validation, audit, and sync data from SQL Server.

In production, SQL Server must not be treated as the upstream source.

The real upstream source is OpenInvoice.

SQL Server is the local operational cache used by InvoiceLens after data is pulled, normalized, and stored by the worker.

The simulation must support this architecture:

```text
OpenInvoice API or OpenInvoice API Simulator
        ↓
InvoiceLens.Worker integration jobs
        ↓
SQL Server operational cache
        ↓
InvoiceLens.Api
        ↓
TypeScript frontend
```

The same worker and same OpenInvoice client must work against both the simulator and the real OpenInvoice environments.

## Required Project Structure

Add a separate mock API project.

Do not place fake OpenInvoice behavior inside `InvoiceLens.Api`.

```text
InvoiceLens/
  src/
    InvoiceLens.Api/
    InvoiceLens.Application/
    InvoiceLens.Domain/
    InvoiceLens.Infrastructure/
    InvoiceLens.Worker/
    InvoiceLens.OpenInvoiceMock/
      Controllers/
      Middleware/
      Data/
      Services/
      Storage/
      Program.cs
```

Add OpenInvoice integration code under infrastructure.

```text
src/InvoiceLens.Infrastructure/OpenInvoice/
  OpenInvoiceOptions.cs
  IOpenInvoiceClient.cs
  HttpOpenInvoiceClient.cs
  OpenInvoiceHmacHandler.cs
  OpenInvoiceCertificateHandler.cs
  OpenInvoiceInvoiceMapper.cs
  OpenInvoiceAttachmentMapper.cs
  OpenInvoiceEventMapper.cs
  OpenInvoiceSyncService.cs
```

Add worker jobs.

```text
src/InvoiceLens.Worker/Jobs/
  SyncOpenInvoiceInvoicesJob.cs
  SyncOpenInvoiceInvoiceDetailsJob.cs
  SyncOpenInvoiceAttachmentsJob.cs
  PostOpenInvoiceEventsJob.cs
  RetryFailedOpenInvoiceEventsJob.cs
```

## Environment Strategy

The integration must be environment-driven.

No base URL, key, certificate path, username, password, tenant value, or security option should be hardcoded.

Use `.env` locally and application settings in deployed environments.

```bash
OpenInvoice__Environment=Mock
OpenInvoice__BaseUrl=http://localhost:5189
OpenInvoice__UseMock=true

OpenInvoice__EnableHmac=true
OpenInvoice__HmacSigningKey=local-test-hmac-key
OpenInvoice__MacHeaderName=mac

OpenInvoice__CertificateEnabled=false
OpenInvoice__CertificatePath=
OpenInvoice__CertificatePassword=

OpenInvoice__EnableAllowedIpSimulation=false
OpenInvoice__AllowedIps=127.0.0.1,::1

OpenInvoice__CompanyId=LOCAL-COMPANY
OpenInvoice__BuyerDuns=000000000

OpenInvoice__TimeoutSeconds=660
OpenInvoice__DefaultPageSize=100
OpenInvoice__MaxRetryCount=3
OpenInvoice__RetryDelaySeconds=10
```

For real environments, the same values should be changed only by configuration.

```bash
OpenInvoice__Environment=Onboard
OpenInvoice__BaseUrl=https://onboard-api.openinvoice.com
OpenInvoice__UseMock=false
OpenInvoice__EnableHmac=true
OpenInvoice__HmacSigningKey=<provided-by-openinvoice>
OpenInvoice__CertificateEnabled=true
OpenInvoice__CertificatePath=<secure-path-or-mounted-secret>
OpenInvoice__CertificatePassword=<secret>
OpenInvoice__AllowedIps=<enverus-allowed-ips>
OpenInvoice__CompanyId=<enverus-company-id>
OpenInvoice__BuyerDuns=<enverus-buyer-duns>
```

## Supported OpenInvoice Environments

The implementation must support these environment names:

```text
Mock
Onboard
UAT
Production
```

Base URLs must be configurable.

Expected real environment examples:

```text
Production: https://api.openinvoice.com
Onboard:    https://onboard-api.openinvoice.com
UAT:        https://onboard-api.openinvoice.com
```

Swagger documentation may exist separately from the API host and may require credentialed access.

Do not rely on Swagger being publicly available during local development.

## Security Requirements

The simulator must support the same security behavior that the production client expects.

### HMAC

Support HMAC SHA256 request authentication.

Use the configured signing key.

Use the configured request header name, defaulting to `mac`.

Rules:

```text
GET input string: empty string
POST input string: raw request body
Algorithm: HMACSHA256
Encoding: UTF-8
Output format: Base64
Header: mac
```

The simulator must reject requests when HMAC is enabled and:

```text
mac header is missing
mac header is invalid
request body was changed after signing
wrong key was used
```

Expected HTTP result:

```text
401 Unauthorized
```

Response body:

```json
{
  "messages": [
    {
      "type": "error",
      "code": "INVALID_MAC",
      "developerMessage": "The request did not include a valid HMAC token."
    }
  ]
}
```

### Client Certificate Readiness

The mock does not need to require a real certificate by default.

The real HTTP client must be built to support client certificates.

Requirements:

```text
Load certificate from configured path.
Support password-protected certificate files.
Attach certificate to HttpClientHandler.
Fail startup clearly if certificate is required but missing.
Never log certificate content or password.
```

### Allowed IP Simulation

The simulator should optionally support allowed IP checks.

When enabled, it should read allowed IPs from configuration.

If the request IP is not allowed, return:

```text
403 Forbidden
```

Response body:

```json
{
  "messages": [
    {
      "type": "error",
      "code": "IP_NOT_ALLOWED",
      "developerMessage": "The request source is not allowed by the OpenInvoice security profile."
    }
  ]
}
```

## Required API Endpoints for Phase 1

Implement only the endpoints needed by InvoiceLens first.

### Invoice Retrieval

```http
GET /docp/supply-chain/v1/invoices
GET /docp/supply-chain/v1/invoices/{invoiceId}
GET /docp/supply-chain/v1/invoices/{invoiceId}/attachments
GET /docp/supply-chain/v1/invoices/{invoiceId}/attachments/{attachmentId}
GET /docp/supply-chain/v1/invoices/{invoiceId}/snapshot
```

### Invoice Events

```http
POST /docp/events/supply-chain/v1/invoice.exports.set
POST /docp/events/supply-chain/v1/invoice.approve
POST /docp/events/supply-chain/v1/invoice.dispute
POST /docp/events/supply-chain/v1/invoice.comment.add
POST /docp/events/supply-chain/v1/invoice.payment.update
POST /docp/events/supply-chain/v1/invoice.payment.release
```

### Event Metadata

Add simple metadata endpoints for local testing.

```http
GET /docp/events/supply-chain/v1/invoice.approve/meta
GET /docp/events/supply-chain/v1/invoice.dispute/meta
GET /docp/events/supply-chain/v1/invoice.comment.add/meta
GET /docp/events/supply-chain/v1/invoice.exports.set/meta
```

## Request and Response Behavior

### Minimal Invoice List

Support:

```http
GET /docp/supply-chain/v1/invoices?$filter=serviceType eq approved and serviceStatus eq pending&$count=true
Prefer: return=minimal
Accept: application/json
```

Return JSON with metadata and links.

```json
{
  "meta": {
    "completeIndicator": true,
    "number": 2,
    "startSequence": 1,
    "totalNumber": 2
  },
  "links": [
    {
      "rel": "invoice",
      "href": "/docp/supply-chain/v1/invoices/5521340"
    },
    {
      "rel": "invoice",
      "href": "/docp/supply-chain/v1/invoices/5521341"
    }
  ]
}
```

### Representational Invoice List

Support:

```http
GET /docp/supply-chain/v1/invoices?$filter=status eq approved&$select=*
Prefer: return=representation
Accept: application/xml
```

Return XML with invoice details and links to snapshots and attachments.

The XML does not need to match the full production schema in Phase 1, but it must be stable and parseable.

Use XML libraries, not string-position parsing.

### Single Invoice

Support:

```http
GET /docp/supply-chain/v1/invoices/{invoiceId}?$select=all
Accept: application/xml
```

Return invoice XML including:

```text
OpenInvoice document ID
invoice number
supplier number
supplier name
status
service type
service status
invoice date
received date
approved date when available
currency
subtotal
tax
total
line items
coding fields
attachment links
snapshot link
last action date
```

### Attachments

Support:

```http
GET /docp/supply-chain/v1/invoices/{invoiceId}/attachments
```

Return JSON attachment metadata.

```json
{
  "meta": {
    "completeIndicator": true,
    "number": 1
  },
  "attachments": [
    {
      "attachmentId": "att-1001",
      "fileName": "field-ticket-1001.pdf",
      "contentType": "application/pdf",
      "sizeBytes": 124000,
      "links": [
        {
          "rel": "self",
          "href": "/docp/supply-chain/v1/invoices/5521340/attachments/att-1001"
        }
      ]
    }
  ]
}
```

### Snapshot

Support:

```http
GET /docp/supply-chain/v1/invoices/{invoiceId}/snapshot
```

Return a PDF file stream.

Use a local sample PDF stored under:

```text
src/InvoiceLens.OpenInvoiceMock/Storage/snapshots/
```

### Content Encoding

Support gzip where practical.

The client must inspect `Content-Encoding`.

The simulator should be able to return:

```text
Content-Encoding: gzip
```

for JSON, XML, and eligible text attachments when configured.

## OData Filter Support

The simulator does not need a full OData engine.

It must support the filters InvoiceLens needs.

Minimum supported filters:

```text
serviceType eq approved
serviceType eq submitted
serviceStatus eq pending
serviceStatus eq completed
status eq submitted
status eq resubmitted
status eq approved
status eq disputed
status eq cancelled
status eq deleted
lastActionDate ge yyyy-mm-dd
lastActionDate le yyyy-mm-dd
approvedDate ge yyyy-mm-dd
approvedDate le yyyy-mm-dd
invoiceNumber eq 'VALUE'
supplierNumber eq 'VALUE'
```

Also support:

```text
$count=true
$top=number
$skip=number
$select=invoice
$select=attachments
$select=snapshot
$select=all
$select=*
resourceSetSaveIndicator=true
resourceSetID=number
```

For unsupported filters, return:

```text
400 Bad Request
```

Response body:

```json
{
  "messages": [
    {
      "type": "error",
      "code": "UNSUPPORTED_FILTER",
      "developerMessage": "This simulator does not support the requested filter expression."
    }
  ]
}
```

## Mock Data Requirements

Store mock data as files, not hardcoded controller lists.

```text
src/InvoiceLens.OpenInvoiceMock/Data/
  invoices.json
  invoice-lines.json
  suppliers.json
  attachments.json
  event-history.json

src/InvoiceLens.OpenInvoiceMock/Storage/
  snapshots/
    5521340.pdf
    5521341.pdf
  attachments/
    att-1001.pdf
    att-1002.xlsx
```

Mock invoices must cover these states:

```text
submitted
resubmitted
approved
disputed
cancelled
deleted
```

Mock invoices must cover these processing cases:

```text
valid invoice
invoice with missing AFE
invoice with missing cost center
invoice with duplicate invoice number
invoice with tax mismatch
invoice with line total mismatch
invoice with missing attachment
invoice with large attachment
invoice with unsupported workflow transition
```

## Invoice Event Behavior

The simulator must update its local state when event endpoints are called.

### Export Status

Endpoint:

```http
POST /docp/events/supply-chain/v1/invoice.exports.set
Content-Type: application/json
```

Expected payload shape:

```json
{
  "context": {
    "documentId": "5521340",
    "invoiceNumber": "INV-1001",
    "supplierNumber": "SUP-001"
  },
  "transform": {
    "serviceType": "approved",
    "serviceStatus": "success",
    "comment": "Exported to InvoiceLens."
  }
}
```

Rules:

```text
success changes serviceStatus to completed
failure changes serviceStatus to failed
inprogress changes serviceStatus to inprogress
append event to event-history.json
return JSON success response
```

### Approve Invoice

Endpoint:

```http
POST /docp/events/supply-chain/v1/invoice.approve
```

Rules:

```text
submitted, resubmitted, disputed can become approved
approved cannot be approved again unless simulator setting allows idempotency
cancelled and deleted cannot be approved
append event history
```

### Dispute Invoice

Endpoint:

```http
POST /docp/events/supply-chain/v1/invoice.dispute
```

Rules:

```text
submitted, resubmitted, approved can become disputed
cancelled and deleted cannot be disputed
comment is required
append event history
```

### Comment

Endpoint:

```http
POST /docp/events/supply-chain/v1/invoice.comment.add
```

Rules:

```text
status does not change
comment is required
visibility may be public or private
append event history
```

## Worker Requirements

The worker must treat the simulator exactly like the real OpenInvoice API.

Do not create simulator-specific sync logic.

The worker must:

```text
read OpenInvoice options from configuration
create HttpClient with timeout greater than 10 minutes
add HMAC header when enabled
attach client certificate when enabled
request invoice list
page through results using $top and $skip
pull invoice XML
pull snapshot
pull attachment metadata
pull attachment files
normalize and persist to SQL Server
write raw API responses to OpenInvoiceRawDocuments
write sync run status to OpenInvoiceSyncRuns
write cursor state to OpenInvoiceSyncCursors
post export status after successful ingestion
retry transient failures
avoid duplicate invoice creation
```

## SQL Persistence Requirements

Add or validate these database tables.

```text
OpenInvoiceSyncRuns
  Id
  Environment
  StartedAtUtc
  CompletedAtUtc
  Status
  RecordsRequested
  RecordsImported
  RecordsFailed
  ErrorMessage

OpenInvoiceSyncCursors
  Id
  Environment
  ServiceType
  LastSuccessfulSyncUtc
  LastResourceSetId
  UpdatedAtUtc

OpenInvoiceRawDocuments
  Id
  OpenInvoiceDocumentId
  DocumentType
  SourceEndpoint
  ContentType
  ContentEncoding
  RawBody
  BodyHash
  ReceivedAtUtc

OpenInvoiceEventOutbox
  Id
  OpenInvoiceDocumentId
  EventType
  PayloadJson
  Status
  AttemptCount
  LastAttemptAtUtc
  LastError
  CreatedAtUtc
  CompletedAtUtc

InvoiceAttachments
  Id
  InvoiceId
  OpenInvoiceAttachmentId
  FileName
  ContentType
  SizeBytes
  StoragePath
  BodyHash
  CreatedAtUtc

InvoiceSnapshots
  Id
  InvoiceId
  StoragePath
  ContentType
  SizeBytes
  BodyHash
  CreatedAtUtc
```

Use existing InvoiceLens invoice tables where possible.

Do not duplicate business invoice tables if they already exist.

## Outbox Pattern Requirement

User actions must not directly call OpenInvoice from the frontend request path.

When the user approves, disputes, comments, or updates payment status:

```text
InvoiceLens.Api saves local action
InvoiceLens.Api writes OpenInvoiceEventOutbox row
InvoiceLens.Worker posts event to OpenInvoice
InvoiceLens.Worker updates outbox status
InvoiceLens.Worker updates local invoice sync status
```

This gives retry, audit, and safe recovery.

## Error Simulation

The mock API must support failure injection.

Use configuration or query headers.

Examples:

```http
x-openinvoice-simulate-error: 500
x-openinvoice-simulate-timeout: true
x-openinvoice-simulate-invalid-gzip: true
x-openinvoice-simulate-rate-limit: true
```

Required simulated errors:

```text
400 invalid filter
401 missing mac
401 invalid mac
403 IP blocked
404 invoice not found
404 attachment not found
409 invalid workflow transition
413 attachment too large
415 unsupported media type
429 rate limit
500 server error
504 timeout
```

The worker must log and persist failures.

The frontend should show sync failure states without crashing.

## Logging Requirements

Log:

```text
environment
endpoint
method
status code
duration
invoice document ID when available
sync run ID when available
event outbox ID when available
retry attempt
```

Never log:

```text
HMAC key
certificate password
certificate private key
full attachment binary
full PDF binary
production secrets
```

## Production Readiness Checklist

Before switching from Mock to Onboard or UAT, confirm:

```text
OpenInvoice support has enabled APIs for the company
security certificate has been issued or imported
HMAC key has been generated if HMAC is enabled
allowed IP settings are known if IP verification is enabled
base URL is configured from environment
client certificate is loaded securely
mac header is generated correctly
GET requests sign an empty string
POST requests sign the raw payload
timeout is greater than 10 minutes
worker retries transient failures
worker stores raw responses
worker stores sync cursors
worker posts export status after import
manual retry exists for failed events
secrets are not committed to source control
```

## Definition of Done

The implementation is complete when:

```text
InvoiceLens.OpenInvoiceMock runs locally
InvoiceLens.Worker can sync invoices from the mock API into SQL Server
InvoiceLens.Api reads synced invoices from SQL Server
TypeScript frontend displays synced invoices
PDF snapshot loads from synced data
attachments load from synced data
approve event writes to outbox
worker posts approve event to mock API
mock API changes invoice status
worker updates SQL Server status
invalid HMAC requests are rejected
simulated 500 and timeout errors are retried
configuration can switch BaseUrl from Mock to Onboard without code changes
```

## Suggested Build Order

1. Create `InvoiceLens.OpenInvoiceMock`.
2. Add mock invoice data files.
3. Implement HMAC validation middleware.
4. Implement invoice list and single invoice endpoints.
5. Implement snapshot and attachment endpoints.
6. Implement invoice event endpoints.
7. Add `IOpenInvoiceClient` and `HttpOpenInvoiceClient`.
8. Add HMAC request signing handler.
9. Add optional certificate handler.
10. Add worker sync job.
11. Add SQL raw document and sync run tables.
12. Add event outbox.
13. Add retry and failure simulation tests.
14. Switch configuration from Mock to Onboard when credentials are available.

## Agent Instructions

When implementing this README, follow these rules:

```text
Do not remove existing InvoiceLens frontend pages.
Do not replace the TypeScript frontend with a framework.
Do not hardcode OpenInvoice secrets.
Do not hardcode OpenInvoice base URLs inside code.
Do not make the browser call OpenInvoice directly.
Do not put OpenInvoice credentials in the frontend.
Do not bypass the worker and write fake invoices directly into SQL for integration testing.
Do not create a mock that uses different route names from OpenInvoice.
Do not skip HMAC because it is local.
Do not skip raw response storage.
Do not skip the outbox pattern.
```

Build the simulator so the real production switch is a configuration change, not a rewrite.

## Switch-Over Guide

The production switch-over is configuration-only. The worker, SQL persistence, OpenInvoice client, comparison logic, and frontend stay the same.

### A. How to run against Mock

1. Start `InvoiceLens.OpenInvoiceMock`.
2. Set `OpenInvoice__Environment=Mock`.
3. Set `OpenInvoice__BaseUrl=http://localhost:5189` or the local mock port.
4. Set `OpenInvoice__UseMock=true`.
5. Set `OpenInvoice__HmacSigningKey=local-test-hmac-key`.
6. Keep `OpenInvoice__CertificateEnabled=false` unless you are validating certificate loading locally.
7. Run the API and worker. They use the same OpenInvoice client and sync jobs as real environments.

### B. How to switch to Onboard/UAT

1. Set `OpenInvoice__Environment=Onboard` or `OpenInvoice__Environment=UAT`.
2. Update `OpenInvoice__BaseUrl` to the Enverus-provided Onboard/UAT URL.
3. Set `OpenInvoice__UseMock=false`.
4. Replace `OpenInvoice__HmacSigningKey` with the real signing key.
5. Set `OpenInvoice__CertificateEnabled=true`.
6. Set `OpenInvoice__CertificatePath` and `OpenInvoice__CertificatePassword` to the issued certificate values.
7. Update `OpenInvoice__AllowedIps`, `OpenInvoice__CompanyId`, and `OpenInvoice__BuyerDuns` from the environment-specific values.

### C. How to switch to Production

1. Keep the code unchanged.
2. Change only the OpenInvoice configuration values for Production.
3. Use the Production base URL and Production signing key.
4. Keep the production certificate, allowed IPs, company ID, and buyer DUNS aligned with the production tenant.
5. Leave the worker schedules, SQL schema, and frontend untouched.

### D. Which code stays unchanged during switch-over

1. `src/InvoiceLens.Infrastructure/OpenInvoice/HttpOpenInvoiceClient.cs`
2. `src/InvoiceLens.Infrastructure/OpenInvoice/OpenInvoiceHmacHandler.cs`
3. `src/InvoiceLens.Infrastructure/OpenInvoice/OpenInvoiceCertificateHandler.cs`
4. `src/InvoiceLens.Infrastructure/OpenInvoice/OpenInvoiceSyncService.cs`
5. `src/InvoiceLens.Worker/Jobs/*`
6. `src/InvoiceLens.Api` controllers and persistence
7. `src/InvoiceLens.OpenInvoiceMock` routes and storage-backed state
8. `apps/web` pages and comparison views

### E. Which config values must be replaced with real Enverus/OpenInvoice values

1. `OpenInvoice__Environment`
2. `OpenInvoice__BaseUrl`
3. `OpenInvoice__HmacSigningKey`
4. `OpenInvoice__CertificateEnabled`
5. `OpenInvoice__CertificatePath`
6. `OpenInvoice__CertificatePassword`
7. `OpenInvoice__AllowedIps`
8. `OpenInvoice__CompanyId`
9. `OpenInvoice__BuyerDuns`

### F. What still requires confirmation from Enverus

1. The exact Mock, Onboard/UAT, and Production base URLs.
2. The final signing key and header expectations.
3. The required certificate format and delivery mechanism.
4. The allowed IP ranges for each environment.
5. The tenant-specific company ID and buyer DUNS values.
6. Any workflow constraints or payload fields not present in the mock.
7. Whether gzip is enabled for every supported response type.
8. Any additional invoice fields that need mapping before go-live.
