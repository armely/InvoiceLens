$ErrorActionPreference = "Stop"

az deployment sub create `
  --name invoicelens-prod-infra `
  --location centralus `
  --template-file ../main.bicep `
  --parameters ../parameters/prod.bicepparam
