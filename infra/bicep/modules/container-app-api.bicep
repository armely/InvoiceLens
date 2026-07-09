param name string
param location string
param environmentId string
param acrServer string
param apiImage string
param openInvoiceBaseUrl string = ''
param openInvoiceHmacSigningKey string = ''

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  properties: {
    managedEnvironmentId: environmentId
    configuration: {
      ingress: {
        external: true
        targetPort: 8080
      }
      registries: []
      secrets: []
    }
    template: {
      containers: [
        {
          name: 'api'
          image: '${acrServer}/${apiImage}'
          env: [
            {
              name: 'OpenInvoice__BaseUrl'
              value: openInvoiceBaseUrl
            }
            {
              name: 'OpenInvoice__HmacSigningKey'
              value: openInvoiceHmacSigningKey
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
        maxReplicas: 3
      }
    }
  }
}

output id string = app.id
