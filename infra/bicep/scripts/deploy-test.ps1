$ErrorActionPreference = "Stop"

az deployment sub create `
  --name invoicelens-test-infra `
  --location eastus2 `
  --template-file ../main.bicep `
  --parameters ../parameters/test.bicepparam
