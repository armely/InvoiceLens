param name string
param location string
param appServicePlanId string
param acrServer string
param webImage string

resource site 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  kind: 'app,linux,container'
  properties: {
    serverFarmId: appServicePlanId
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acrServer}/${webImage}'
      alwaysOn: true
    }
    httpsOnly: true
  }
}

output id string = site.id
output defaultHostName string = site.properties.defaultHostName
