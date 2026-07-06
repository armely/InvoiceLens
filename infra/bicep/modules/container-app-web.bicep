param name string
param location string
param environmentId string
param acrServer string
param webImage string
param authClientId string = ''
param authTenantId string = ''
param authRedirectUri string = ''
param authPostLogoutRedirectUri string = ''
param authScopes string = 'openid profile email'

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 80
      }
      registries: []
      secrets: []
    }
    template: {
      containers: [
        {
          name: 'web'
          image: '${acrServer}/${webImage}'
          env: [
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
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
      }
    }
  }
}

output id string = app.id
