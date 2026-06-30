param environmentName string
param location string
param logAnalyticsCustomerId string
@secure()
param logAnalyticsSharedKey string
param acrServer string
param apiImage string
param webImage string
param workerImage string

module environment './container-apps-environment.bicep' = {
	params: {
		name: environmentName
		location: location
		logAnalyticsCustomerId: logAnalyticsCustomerId
		logAnalyticsSharedKey: logAnalyticsSharedKey
	}
}

module api './container-app-api.bicep' = {
	params: {
		name: '${environmentName}-api'
		location: location
		environmentId: environment.outputs.id
		acrServer: acrServer
		apiImage: apiImage
	}
}

module web './container-app-web.bicep' = {
	params: {
		name: '${environmentName}-web'
		location: location
		environmentId: environment.outputs.id
		acrServer: acrServer
		webImage: webImage
	}
}

module worker './worker-container-job.bicep' = {
	params: {
		name: '${environmentName}-worker'
		location: location
		managedEnvironmentId: environment.outputs.id
		acrServer: acrServer
		workerImage: workerImage
	}
}

output environmentId string = environment.outputs.id
output apiId string = api.outputs.id
output webId string = web.outputs.id
output workerId string = worker.outputs.id
