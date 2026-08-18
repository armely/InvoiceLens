param location string
param namePrefix string
param apiResourceId string
param operationsEmail string = ''

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (operationsEmail != '') {
  name: '${namePrefix}-operations'
  location: 'global'
  properties: {
    groupShortName: 'InvLensOps'
    enabled: true
    emailReceivers: [
      {
        name: 'operations'
        emailAddress: operationsEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

resource apiErrors 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${namePrefix}-api-http5xx'
  location: 'global'
  properties: {
    description: 'InvoiceLens API is returning server errors.'
    severity: 1
    enabled: true
    scopes: [apiResourceId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'Http5xxErrors'
          metricNamespace: 'Microsoft.Web/sites'
          metricName: 'Http5xx'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    autoMitigate: true
    actions: operationsEmail == '' ? [] : [
      { actionGroupId: actionGroup!.id }
    ]
  }
}
