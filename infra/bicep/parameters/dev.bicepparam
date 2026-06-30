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
