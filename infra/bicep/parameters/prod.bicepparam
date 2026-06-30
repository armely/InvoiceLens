using '../main.bicep'

param location = 'centralus'
param environment = 'prod'
param resourcePrefix = 'invoicelens'

param sqlAdminLogin = 'sqladminuser'
param sqlAdminPassword = 'replace-with-secure-value'
param logAnalyticsSharedKey = 'replace-with-secure-value'

param apiImage = 'invoicelens-api:prod'
param webImage = 'invoicelens-web:prod'
param workerImage = 'invoicelens-worker:prod'
