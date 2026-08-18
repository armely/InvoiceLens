param name string
param location string
param appServicePlanId string
param acrServer string
param apiImage string
param userAssignedIdentityId string
param openInvoiceBaseUrl string = ''
param keyVaultName string = ''
param sqlServerHost string = ''
param sqlDatabaseName string = 'InvoiceLens'
param sqlUsername string = ''
param authClientId string = ''
param authTenantId string = ''
param applicationInsightsConnectionString string = ''

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${userAssignedIdentityId}': {}
    }
  }
  properties: {
    serverFarmId: appServicePlanId
    siteConfig: {
      acrUseManagedIdentityCreds: true
      acrUserManagedIdentityID: userAssignedIdentityId
      linuxFxVersion: 'DOCKER|${acrServer}/${apiImage}'
      alwaysOn: true
      healthCheckPath: '/health/ready'
      appSettings: [
        {
          name: 'ASPNETCORE_URLS'
          value: 'http://+:8080'
        }
        {
          name: 'WEBSITES_PORT'
          value: '8080'
        }
        {
          name: 'WEBSITES_ENABLE_APP_SERVICE_STORAGE'
          value: 'true'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsightsConnectionString
        }
        {
          name: 'AllowedHosts'
          value: '${name}.azurewebsites.net'
        }
        {
          name: 'OpenInvoice__BaseUrl'
          value: openInvoiceBaseUrl
        }
        {
          name: 'OpenInvoice__HmacSigningKey'
          value: keyVaultName == '' ? '' : '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=openinvoice-hmac-key)'
        }
        {
          name: 'OpenInvoice__SyncLookbackDays'
          value: '3650'
        }
        {
          name: 'OpenInvoice__StoragePath'
          value: '/home/data/OpenInvoiceStorage'
        }
        {
          name: 'InvoiceLens__Sql__ServerHost'
          value: sqlServerHost
        }
        {
          name: 'InvoiceLens__Sql__DatabaseName'
          value: sqlDatabaseName
        }
        {
          name: 'InvoiceLens__Sql__Username'
          value: sqlUsername
        }
        {
          name: 'InvoiceLens__Sql__Password'
          value: keyVaultName == '' ? '' : '@Microsoft.KeyVault(VaultName=${keyVaultName};SecretName=sql-password)'
        }
        {
          name: 'InvoiceLens__Auth__ClientId'
          value: authClientId
        }
        {
          name: 'InvoiceLens__Auth__TenantId'
          value: authTenantId
        }
      ]
    }
    httpsOnly: true
  }
}

output id string = site.id
output defaultHostName string = site.properties.defaultHostName
