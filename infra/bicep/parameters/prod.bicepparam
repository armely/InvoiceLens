using '../main.bicep'

param location = 'centralus'
param environment = 'prod'
param resourcePrefix = 'invoicelens'

param sqlAdminLogin = 'sqladminuser'
param sqlAdminPassword = readEnvironmentVariable('INVOICELENS_SQL_ADMIN_PASSWORD')

param apiImage = 'invoicelens-api:prod'
param webImage = 'invoicelens-web:prod'
param workerImage = 'invoicelens-worker:prod'
param openInvoiceMockImage = 'invoicelens-openinvoicemock:prod'

param deployAppServiceWebApi = true
param deployContainerAppWebApi = false
param deployWorkerJob = false
param deployOpenInvoiceMock = false

param authClientId = ''
param authTenantId = ''
param authRedirectUri = ''
param authPostLogoutRedirectUri = ''
param authScopes = 'openid profile email'
param operationsEmail = readEnvironmentVariable('INVOICELENS_OPERATIONS_EMAIL')
