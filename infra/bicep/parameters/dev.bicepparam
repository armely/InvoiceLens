using '../main.bicep'

param location = 'eastus'
param sqlLocation = 'eastus2'
param environment = 'dev'
param resourcePrefix = 'invoicelens'

param sqlAdminLogin = 'sqladminuser'
param sqlAdminPassword = 'replace-with-secure-value'

param apiImage = 'invoicelens-api:dev'
param webImage = 'invoicelens-web:dev'
param workerImage = 'invoicelens-worker:dev'
param openInvoiceMockImage = 'invoicelens-openinvoicemock:dev'

param deployAppServiceWebApi = true
param deployContainerAppWebApi = false
param deployWorkerJob = false
param deployOpenInvoiceMock = false

param appServicePlanSkuName = 'B1'
param appServicePlanSkuTier = 'Basic'
param appServicePlanSkuCapacity = 1

param authClientId = ''
param authTenantId = ''
param authRedirectUri = ''
param authPostLogoutRedirectUri = ''
param authScopes = 'openid profile email'
