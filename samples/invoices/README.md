# Local Invoice Samples

These files power the local invoice comparison workflow.

- `pdf/` holds sample vendor invoice PDFs.
- `metadata/` holds matching JSON metadata so the comparison engine can run without OCR.

The sample set now includes the local PDFs that mirror the first 20 seeded invoice records from `database/scripts/seed-local-data.sql`, plus two edge cases that keep comparison testing useful.

Seeded invoice samples:

- `INV-260701-0001` through `INV-260701-0020` mirror the first 20 SQL-backed invoices.

Edge cases:

- `INV-260701-0999` has no matching SQL invoice.
- `INV-AMBIG-0001` is intended to produce multiple possible SQL matches.
