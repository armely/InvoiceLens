using '../main.bicep'

param location = 'eastus2'
param environment = 'test'
param resourcePrefix = 'invoicelens'

param sqlAdminLogin = 'sqladminuser'
param sqlAdminPassword = 'replace-with-secure-value'
param logAnalyticsSharedKey = 'replace-with-secure-value'

param apiImage = 'invoicelens-api:test'
param webImage = 'invoicelens-web:test'
param workerImage = 'invoicelens-worker:test'
