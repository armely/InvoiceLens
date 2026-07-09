param name string
param location string
param appServicePlanId string
param acrServer string
param webImage string
param userAssignedIdentityId string
param apiBaseUrl string = ''
param authClientId string = ''
param authTenantId string = ''
param authRedirectUri string = ''
param authPostLogoutRedirectUri string = ''
param authScopes string = 'openid profile email'

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
      linuxFxVersion: 'DOCKER|${acrServer}/${webImage}'
      alwaysOn: true
      appSettings: [
        {
          name: 'PORT'
          value: '4200'
        }
        {
          name: 'WEBSITES_PORT'
          value: '4200'
        }
        {
          name: 'API_BASE_URL'
          value: apiBaseUrl
        }
        {
          name: 'InvoiceLens__Auth__ClientId'
          value: authClientId
        }
        {
          name: 'InvoiceLens__Auth__TenantId'
          value: authTenantId
        }
        {
          name: 'InvoiceLens__Auth__RedirectUri'
          value: authRedirectUri
        }
        {
          name: 'InvoiceLens__Auth__PostLogoutRedirectUri'
          value: authPostLogoutRedirectUri
        }
        {
          name: 'InvoiceLens__Auth__Scopes'
          value: authScopes
        }
      ]
    }
    httpsOnly: true
  }
}

output id string = site.id
output defaultHostName string = site.properties.defaultHostName
