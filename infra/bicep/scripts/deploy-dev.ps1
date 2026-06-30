$ErrorActionPreference = "Stop"

az deployment sub create `
  --name invoicelens-dev-infra `
  --location eastus `
  --template-file ../main.bicep `
  --parameters ../parameters/dev.bicepparam
