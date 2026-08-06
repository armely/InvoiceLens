# Local API and sync runbook

This short runbook covers the local OpenInvoice mock, API, worker, and web app workflow.

## Services

- OpenInvoice mock: http://localhost:5189/health
- API: http://localhost:5106/health
- Web app: http://localhost:4200

## Start everything

```powershell
Set-Location "C:\Users\lmwangi\Desktop\InvoiceLens"
.\scripts\start-local-stack.ps1
```

## Stop everything

```powershell
Set-Location "C:\Users\lmwangi\Desktop\InvoiceLens"
.\scripts\stop-local-stack.ps1
```

## Notes

- The worker uses the local mock endpoint from the root .env file when `OpenInvoice__UseMock=true`.
- The API requires an authenticated session for most protected endpoints.
