# InvoiceLens

InvoiceLens is a .NET invoice processing platform with a lightweight TypeScript frontend. The browser app is now framework-free and organized into view modules, while the API, worker, and infrastructure projects stay in .NET.

## Repository Layout

```text
InvoiceLens/
  apps/web/        TypeScript frontend
  front-end/       Design prototype source
  src/             .NET API, application, infrastructure, worker
  database/        SQL scripts and migrations
  infra/           Azure Bicep templates
  pipelines/       Build and deployment pipelines
  docs/            Discovery, requirements, architecture, runbooks
```

## Frontend

The production frontend lives in `apps/web`.

It is organized into:

```text
apps/web/src/
  shared/   data, models, and utilities
  views/    page-specific renderers
  app.ts    shell, routing, and event handling
  main.ts   browser entrypoint
```

The visual language comes from the prototype in `front-end/`, which is the design reference for the workspace layout, cards, queue views, review screen, validation summary, and admin screen.

## Backend

The backend is still .NET:

- `src/InvoiceLens.Api`
- `src/InvoiceLens.Application`
- `src/InvoiceLens.Domain`
- `src/InvoiceLens.Infrastructure`
- `src/InvoiceLens.Worker`

## Local Development

### Configuration

Create a root `.env` file by copying [`.env.example`](.env.example).

SQL Server is mandatory for InvoiceLens. The API, worker, comparison pages, validation results, audit trail, and imported OpenInvoice data all use SQL Server.

That file is the place for local SQL settings and environment-specific values, including the host, database name, username, and password. Use one of the supported SQL Server connection patterns in [`.env.example`](.env.example):

- Local SQL Server or Docker SQL Server on `localhost,1433`
- SQL Server Express on `localhost\SQLEXPRESS`
- Azure SQL on `your-server.database.windows.net`

Example local values:

```bash
InvoiceLens__Sql__ServerHost=localhost,1433
InvoiceLens__Sql__DatabaseName=InvoiceLens
InvoiceLens__Sql__Username=sa
InvoiceLens__Sql__Password=Your_password123
InvoiceLens__Sql__Encrypt=False
InvoiceLens__Sql__TrustServerCertificate=True
```

If you are creating a new cloud database, follow [the Azure SQL setup guide](docs/setup/azure-sql-database.md).

### Frontend

```bash
cd apps/web
npm install
npm run build
npm run start
```

`npm run build` compiles TypeScript into `apps/web/dist` and copies the static HTML/CSS.

### Backend

Use the normal .NET workflow from the solution root:

```bash
dotnet build InvoiceLens.sln
dotnet run --project src/InvoiceLens.Api
```

The API and worker both read the root `.env` file automatically during startup if it exists.

`ConnectionStrings:InvoiceLensDb` is built from the SQL host, database, username, and password values in `.env`.

If SQL Server is unreachable, the API will now fail fast with a startup message that points you back to the SQL settings and the likely host format.

If you want Microsoft sign-in to unlock the workspace, create an app registration in Microsoft Entra ID and fill these values in `.env` and deployment settings:

- `InvoiceLens__Auth__ClientId`
- `InvoiceLens__Auth__TenantId`
- `InvoiceLens__Auth__RedirectUri`
- `InvoiceLens__Auth__PostLogoutRedirectUri`
- `InvoiceLens__Auth__Scopes`

The frontend uses those values to run a PKCE-based Microsoft login flow, then exchanges the code for a server-side session cookie and reads the signed-in name from the validated Microsoft token claims.
You do not need a client secret for the SPA sign-in flow.

For local development, use the exact redirect URI your app is actually served on. In this repo that is `http://localhost:4200/`, and it must match the redirect URI registered in Microsoft Entra ID exactly.

The backend now uses SQL-backed repositories for invoices, queue state, validation, audit, and sync data.

To load the local sample data set, run `database/scripts/seed-local-data.sql` against the database.

## Notes

- The frontend no longer uses Angular.
- Pages are separated into view files so the workspace stays easy to extend.
- The browser only talks to the API; secrets and OpenInvoice access stay on the server side.
