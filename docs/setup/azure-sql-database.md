# Azure SQL Database Setup

This project is aligned to a cloud SQL setup based on Azure SQL Database.

## Recommended choice

Use **Azure SQL Database** for a new InvoiceLens database unless you specifically need SQL Server instance features like SQL Server Agent, linked servers, or cross-database queries. Azure SQL Database is fully managed and handles patching, backups, and monitoring for you. If you need near-full SQL Server compatibility, use Azure SQL Managed Instance instead.

## Create the database

In the Azure portal:

1. Go to Azure SQL.
2. Create a new **SQL database**.
3. Create a new logical server.
4. Choose **General Purpose** for a budget-friendly default.
5. For development, use **Serverless** if you want autoscaling and pause/resume behavior.
6. Set networking so only the correct clients can connect.
7. Add your current IP address during development.

The Azure quickstart for a single database uses the portal, Azure CLI, or PowerShell and recommends adding your current client IP during networking setup. It also shows the `az sql server create`, `az sql server firewall-rule create`, and `az sql db create` workflow. 

## Environment variables

The repo now expects these values in the root `.env` file:

```env
ASPNETCORE_ENVIRONMENT=Development
DOTNET_ENVIRONMENT=Development
InvoiceLens__Sql__ServerHost=your-server.database.windows.net
InvoiceLens__Sql__DatabaseName=InvoiceLens
InvoiceLens__Sql__Username=your-admin-user
InvoiceLens__Sql__Password=your-strong-password
InvoiceLens__Sql__Encrypt=True
InvoiceLens__Sql__TrustServerCertificate=False
InvoiceLens__Sql__Provider=SqlServer
InvoiceLens__Sql__CommandTimeoutSeconds=30
SyncSchedule__IncrementalSyncMinutes=60
SyncSchedule__ReconciliationMinutes=240
SyncSchedule__RetryMinutes=30
```

The API and worker build `ConnectionStrings:InvoiceLensDb` from those values at startup. For local dev, keep the values in [`.env`](../../.env). For Azure, set the same keys in App Service application settings or your deployment pipeline secret store.

## Database scripts

Run the SQL files in this order:

1. `database/migrations/001_create_invoice_tables.sql`
2. `database/migrations/002_create_sync_tables.sql`
3. `database/migrations/003_create_invoice_indexes.sql`
4. `database/migrations/004_create_validation_tables.sql`
5. `database/migrations/005_create_audit_tables.sql`
6. `database/migrations/006_create_msa_contract_tables.sql`

Or use `database/scripts/create-schema.sql` to create the full schema from scratch.

## What the repo is aligned for

- Invoice tables
- Sync checkpoints, batches, and errors
- Validation results and validation rules
- Audit trail
- MSA contract data
- SQL-backed invoice, queue, validation, audit, and sync repositories

## Seed data

Run `database/scripts/seed-local-data.sql` to populate at least 20 records in each table for local development and smoke testing.
