# InvoiceLens Local Invoice Comparison Instructions

## Purpose

This document defines how InvoiceLens should compare locally created sample vendor invoices against invoice records already stored in SQL Server.

The goal is to simulate the real production workflow before connecting to OpenInvoice.

In production, the comparison will be:

```text
Client-side vendor invoice
        vs
OpenInvoice invoice record
```

For local development, the comparison will be:

```text
Local sample vendor invoice PDF
        vs
SQL Server invoice record
```

The database already contains a larger sample set of invoice records. The first 20 are mirrored by local PDF samples during local testing, and the extra records provide broader workspace data.

---

## Business Meaning

InvoiceLens is not comparing client invoices to vendor invoices as two different business documents.

The document is still a vendor invoice.

The comparison is between two copies or representations of the same vendor invoice:

1. The vendor invoice file available on the client side.
2. The invoice record stored in the system, which represents the OpenInvoice-side record for now.

Use this wording in the application and documentation:

```text
Client-side vendor invoice vs system invoice record
```

Avoid this wording:

```text
Client invoice vs vendor invoice
```

That wording can confuse the business meaning.

---

## Implementation Files

The current live comparison workflow is implemented in these files:

```text
src/InvoiceLens.Infrastructure/InvoiceComparison/SqlInvoiceComparisonService.cs
src/InvoiceLens.Api/Controllers/LocalInvoicesController.cs
apps/web/src/app.ts
apps/web/src/shared/api.ts
apps/web/src/views/comparison.ts
apps/web/src/views/shared.ts
apps/web/src/styles.css
apps/web/src/index.html
```

---

## Current Local Development Flow

```text
Local invoice PDF folder
        ↓
InvoiceLens extraction or mapped sample metadata
        ↓
Comparison engine
        ↓
SQL Server invoice records
        ↓
Validation results
        ↓
Frontend three-pane review screen
```

The live frontend now shows a dedicated comparison page:

```text
Left pane: Comparison queue / matched invoices
Middle pane: Selected local vendor invoice PDF preview
Right pane: Structured comparison results and guardrails
```

---

## Required Folder Structure

Create the following folder structure in the repository:

```text
InvoiceLens/
  samples/
    invoices/
      pdf/
        INV-10001.pdf
        INV-10002.pdf
        INV-10003.pdf
      metadata/
        INV-10001.json
        INV-10002.json
        INV-10003.json
      README.md
```

The PDF files are the local sample vendor invoices.

The JSON metadata files are used to avoid depending on OCR during early development. They should contain the fields that would normally be extracted from the PDF.

---

## Sample Metadata Format

Each local invoice PDF must have a matching JSON file.

Example:

```json
{
  "localInvoiceId": "LOCAL-INV-10001",
  "fileName": "INV-10001.pdf",
  "invoiceNumber": "INV-10001",
  "supplierNumber": "SUP-001",
  "supplierName": "North Ridge Drilling Services",
  "invoiceDate": "2026-06-25",
  "purchaseOrderNumber": "PO-450001",
  "afeNumber": "AFE-2026-001",
  "costCenter": "CC-OPS-100",
  "currency": "USD",
  "subtotal": 9500.00,
  "tax": 760.00,
  "totalAmount": 10260.00,
  "lineItems": [
    {
      "lineNumber": 1,
      "description": "Rig mobilization",
      "quantity": 1,
      "unitPrice": 5000.00,
      "amount": 5000.00
    },
    {
      "lineNumber": 2,
      "description": "Daily drilling support",
      "quantity": 3,
      "unitPrice": 1500.00,
      "amount": 4500.00
    }
  ]
}
```

---

## Database Role

SQL Server currently acts as the system-side invoice source.

For local testing, treat the existing 20 database records as if they came from OpenInvoice.

The database should contain or expose these fields at minimum:

```text
InvoiceId
InvoiceNumber
SupplierNumber
SupplierName
InvoiceDate
PurchaseOrderNumber
AfeNumber
CostCenter
Currency
Subtotal
Tax
TotalAmount
Status
ExportStatus
PaymentStatus
```

If line-item comparison is supported, the database should also contain:

```text
InvoiceLineId
InvoiceId
LineNumber
Description
Quantity
UnitPrice
Amount
Coding
```

---

## Matching Logic

The comparison engine should match a local invoice PDF to a SQL invoice record using a weighted approach.

Primary match fields:

```text
InvoiceNumber
SupplierNumber
```

Secondary match fields:

```text
SupplierName
InvoiceDate
PurchaseOrderNumber
TotalAmount
```

Recommended matching rules:

1. If `InvoiceNumber` and `SupplierNumber` match, treat it as a strong match.
2. If `InvoiceNumber` matches but `SupplierNumber` is missing, use supplier name and total amount.
3. If no strong match exists, mark the invoice as `No Match Found`.
4. If multiple records match, mark the invoice as `Multiple Possible Matches`.
5. Do not auto-approve invoices with weak or ambiguous matches.

---

## Comparison Rules

Compare the local invoice metadata against the SQL invoice record.

Header comparison:

```text
Invoice number
Supplier number
Supplier name
Invoice date
Purchase order number
AFE number
Cost center
Currency
Subtotal
Tax
Total amount
```

Line comparison:

```text
Line number
Description
Quantity
Unit price
Line amount
Coding
```

Workflow comparison:

```text
Status
Export status
Payment status
Approval state
```

---

## Live Routes and APIs

Use these routes in the live app:

```text
/comparison
/invoices
/compliance-queue
/validation-summary
```

The comparison page calls these APIs:

```text
GET  /api/local-invoices
POST /api/local-invoices/load
GET  /api/local-invoices/{localInvoiceFileId}/pdf
POST /api/invoice-comparisons/{localInvoiceFileId}/run
GET  /api/invoice-comparisons/{comparisonRunId}
```

## Local Run Steps

1. Start the API and frontend.
2. Open `/comparison` in the browser.
3. If the local sample invoice table is empty, the frontend will call `POST /api/local-invoices/load` automatically.
4. Select a local sample invoice in the left pane.
5. Review the PDF in the center pane and the structured comparison results on the right.

---

## Validation Result Types

The comparison engine should return structured results.

Use these statuses:

```text
Pass
Warning
Fail
Not Available
```

Use these severity levels:

```text
Low
Medium
High
Critical
```

Example validation result:

```json
{
  "ruleCode": "TOTAL_AMOUNT_MATCH",
  "label": "Total amount match",
  "status": "Fail",
  "severity": "Critical",
  "localValue": "10260.00",
  "systemValue": "10180.00",
  "message": "The local invoice total does not match the system invoice total."
}
```

---

## Result Codes

The comparison engine now emits explicit codes for the main structured checks:

```text
MATCH_STATUS
MISSING_CLIENT_RECORD
MISSING_VENDOR_INVOICE
VENDOR_MISMATCH
INVOICE_NUMBER_MISMATCH
INVOICE_DATE_MISMATCH
PO_MISMATCH
AFE_MISMATCH
COST_CENTER_MISMATCH
CURRENCY_MISMATCH
AMOUNT_MISMATCH
STATUS_MISMATCH
EXPORT_STATUS_MISMATCH
PAYMENT_STATUS_MISMATCH
W9_COMPLIANCE_ISSUE
LINE_ITEM_MISMATCH
```

---

## Suggested SQL Tables

Add these tables if they do not already exist.

```sql
CREATE TABLE LocalInvoiceFiles (
    LocalInvoiceFileId INT IDENTITY(1,1) PRIMARY KEY,
    FileName NVARCHAR(255) NOT NULL,
    FilePath NVARCHAR(1000) NOT NULL,
    MetadataPath NVARCHAR(1000) NULL,
    InvoiceNumber NVARCHAR(100) NULL,
    SupplierNumber NVARCHAR(100) NULL,
    SupplierName NVARCHAR(255) NULL,
    TotalAmount DECIMAL(18,2) NULL,
    LoadedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE InvoiceComparisonRuns (
    ComparisonRunId INT IDENTITY(1,1) PRIMARY KEY,
    LocalInvoiceFileId INT NOT NULL,
    SystemInvoiceId INT NULL,
    MatchStatus NVARCHAR(50) NOT NULL,
    OverallStatus NVARCHAR(50) NOT NULL,
    MatchScore DECIMAL(5,2) NULL,
    CreatedAtUtc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE InvoiceComparisonResults (
    ComparisonResultId INT IDENTITY(1,1) PRIMARY KEY,
    ComparisonRunId INT NOT NULL,
    RuleCode NVARCHAR(100) NOT NULL,
    Label NVARCHAR(255) NOT NULL,
    Status NVARCHAR(50) NOT NULL,
    Severity NVARCHAR(50) NOT NULL,
    LocalValue NVARCHAR(1000) NULL,
    SystemValue NVARCHAR(1000) NULL,
    Message NVARCHAR(2000) NULL
);
```

Map `SystemInvoiceId` to the existing invoice table used by InvoiceLens.

Do not duplicate the existing 20 invoice records unless the current schema cannot support comparison.

---

## Backend Implementation Instructions

Create a comparison service in the application layer.

Suggested files:

```text
src/InvoiceLens.Application/InvoiceComparison/
  CompareInvoiceCommand.cs
  CompareInvoiceResult.cs
  InvoiceComparisonService.cs
  InvoiceMatchService.cs
  InvoiceComparisonRules.cs
```

Create infrastructure readers for local sample files:

```text
src/InvoiceLens.Infrastructure/LocalInvoices/
  LocalInvoiceFileReader.cs
  LocalInvoiceMetadataReader.cs
```

Create API endpoints:

```text
GET  /api/local-invoices
POST /api/local-invoices/load
POST /api/invoice-comparisons/{localInvoiceFileId}/run
GET  /api/invoice-comparisons/{comparisonRunId}
```

The frontend should not read local folders directly.

The frontend should call the .NET API only.

---

## Worker Implementation Instructions

The worker can run local invoice loading and comparison as a job.

Suggested job:

```text
src/InvoiceLens.Worker/Jobs/LoadAndCompareLocalInvoicesJob.cs
```

Job behavior:

1. Read sample invoice metadata files from `samples/invoices/metadata`.
2. Register the matching PDF file in `LocalInvoiceFiles`.
3. Find the matching SQL invoice record.
4. Run comparison rules.
5. Save comparison run and comparison result rows.
6. Make results available to the API and frontend.

---

## Frontend Behavior

The invoice queue should show both matched and unmatched local invoices.

Recommended queue columns:

```text
Invoice Number
Supplier
Local File
Matched System Invoice
Total Amount
Comparison Status
Severity
Last Compared
```

When a user selects an invoice:

```text
Middle pane:
Show the local vendor invoice PDF.

Right pane:
Show comparison results against the SQL invoice record.
```

Recommended right-pane sections:

```text
Match Summary
Header Comparison
Line Item Comparison
Vendor / W-9 Guardrails
Workflow Status
Audit Notes
```

---

## Sample Demo Scenarios

Create local sample invoices that cover these scenarios:

```text
1. Perfect match
2. Total amount mismatch
3. Supplier mismatch
4. Missing PO number
5. Missing AFE number
6. Cost center mismatch
7. Tax mismatch
8. Line item amount mismatch
9. Invoice exists locally but not in SQL
10. Multiple possible SQL matches
```

At least 5 of the core SQL records should have matching local sample invoice PDFs.

At least 3 local PDFs should intentionally contain mismatches.

At least 1 local PDF should have no matching database record.

---

## Environment Configuration

Add these settings to `.env.example`:

```bash
InvoiceLens__LocalInvoices__Enabled=true
InvoiceLens__LocalInvoices__PdfFolder=samples/invoices/pdf
InvoiceLens__LocalInvoices__MetadataFolder=samples/invoices/metadata
InvoiceLens__LocalInvoices__AutoCompareOnStartup=false
InvoiceLens__Comparison__AmountTolerance=0.01
InvoiceLens__Comparison__DateToleranceDays=0
InvoiceLens__Comparison__RequireSupplierNumber=true
```

---

## Production Transition

This local approach should prepare the production OpenInvoice workflow.

Local development:

```text
Local sample PDF + metadata
        vs
SQL invoice record
```

Production:

```text
Client-side vendor invoice
        vs
OpenInvoice XML, PDF snapshot, and attachments
```

The comparison service should not care where the two sides come from.

It should compare two normalized invoice models:

```text
NormalizedInvoice localInvoice
NormalizedInvoice systemInvoice
```

This makes the comparison engine reusable.

---

## Required Design Principle

Do not hardcode comparison logic inside controllers.

Do not make the frontend responsible for comparison.

Do not rely on OCR for the first version.

Do not overwrite existing invoice records during local comparison.

Do not call the real OpenInvoice API from this local comparison feature.

Build the comparison engine so it can later compare against real OpenInvoice data with minimal changes.

---

## Definition of Done

This work is complete when:

```text
Sample invoice PDFs exist locally.
Each PDF has matching metadata JSON.
The app can load local invoices into SQL tracking tables.
The app can match local invoices against existing SQL invoice records.
The app can save comparison runs.
The app can show comparison results in the frontend.
The app can show pass, warning, and fail statuses.
The app can handle no-match and multiple-match cases.
The same comparison service can later be reused for OpenInvoice API data.
```
