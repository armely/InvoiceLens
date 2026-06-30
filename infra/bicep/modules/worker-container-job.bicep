param name string
param location string
param managedEnvironmentId string
param acrServer string
param workerImage string

resource job 'Microsoft.App/jobs@2024-03-01' = {
  name: name
  location: location
  properties: {
    environmentId: managedEnvironmentId
    configuration: {
      triggerType: 'Schedule'
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
