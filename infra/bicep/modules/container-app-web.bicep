param name string
param location string
param environmentId string
param acrServer string
param webImage string

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
