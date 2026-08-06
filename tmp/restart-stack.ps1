$ErrorActionPreference = 'Stop'

Set-Location 'C:\Users\lmwangi\Desktop\InvoiceLens'

Stop-Process -Name dotnet,node -Force -ErrorAction SilentlyContinue

$dotnet = 'C:\Users\lmwangi\Desktop\InvoiceLens\tmp\dotnet10\dotnet.exe'
if (-not (Test-Path $dotnet)) {
  throw 'dotnet10 runtime not found at tmp/dotnet10/dotnet.exe'
}

$node = 'C:\Users\lmwangi\Desktop\InvoiceLens\tmp\node\node-v20.19.5-win-x64\node.exe'
if (-not (Test-Path $node)) {
  throw 'bundled node not found at tmp/node/node-v20.19.5-win-x64/node.exe'
}

Start-Process -FilePath $dotnet -ArgumentList @('run','--project','src/InvoiceLens.Api/InvoiceLens.Api.csproj') -WorkingDirectory 'C:\Users\lmwangi\Desktop\InvoiceLens'
Start-Process -FilePath $dotnet -ArgumentList @('run','--project','src/InvoiceLens.Worker/InvoiceLens.Worker.csproj') -WorkingDirectory 'C:\Users\lmwangi\Desktop\InvoiceLens'
Start-Process -FilePath $node -ArgumentList @('apps/web/scripts/build.mjs') -WorkingDirectory 'C:\Users\lmwangi\Desktop\InvoiceLens'
Start-Process -FilePath $node -ArgumentList @('apps/web/scripts/serve.mjs') -WorkingDirectory 'C:\Users\lmwangi\Desktop\InvoiceLens'

Write-Host 'Started API, Worker, and Web processes.'
