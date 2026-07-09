param name string
param location string
param managedEnvironmentId string
param acrServer string
param workerImage string
param openInvoiceBaseUrl string = ''
param openInvoiceHmacSigningKey string = ''

resource job 'Microsoft.App/jobs@2024-03-01' = {
  name: name
  location: location
  properties: {
    environmentId: managedEnvironmentId
    configuration: {
      triggerType: 'Schedule'
      replicaTimeout: 1800
      scheduleTriggerConfig: {
        cronExpression: '0 */1 * * *'
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: []
      secrets: []
    }
    template: {
      containers: [
        {
          name: 'worker'
          image: '${acrServer}/${workerImage}'
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
    }
  }
}

output id string = job.id
