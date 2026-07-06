using '../main.bicep'

param location = 'eastus'
param environment = 'dev'
param resourcePrefix = 'invoicelens'

param sqlAdminLogin = 'sqladminuser'
param sqlAdminPassword = 'replace-with-secure-value'
param logAnalyticsSharedKey = 'replace-with-secure-value'

param apiImage = 'invoicelens-api:dev'
param webImage = 'invoicelens-web:dev'
param workerImage = 'invoicelens-worker:dev'

param authClientId = ''
param authTenantId = ''
param authRedirectUri = 'http://localhost:4200/'
param authPostLogoutRedirectUri = 'http://localhost:4200/'
param authScopes = 'openid profile email'
