param name string
param location string
param appServicePlanId string
param acrServer string
param apiImage string
param userAssignedIdentityId string
param openInvoiceBaseUrl string = ''
param openInvoiceHmacSigningKey string = ''
param sqlServerHost string = ''
param sqlDatabaseName string = 'InvoiceLens'
param sqlUsername string = ''
@secure()
param sqlPassword string = ''
param authClientId string = ''
param authTenantId string = ''

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
          name: 'OpenInvoice__BaseUrl'
          value: openInvoiceBaseUrl
        }
        {
          name: 'OpenInvoice__HmacSigningKey'
          value: openInvoiceHmacSigningKey
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
          value: sqlPassword
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
