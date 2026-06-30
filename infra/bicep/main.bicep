targetScope = 'subscription'

param location string
param environment string
param resourcePrefix string

param sqlAdminLogin string
@secure()
param sqlAdminPassword string

@secure()
param logAnalyticsSharedKey string

param apiImage string = 'invoicelens-api:latest'
param webImage string = 'invoicelens-web:latest'
param workerImage string = 'invoicelens-worker:latest'

var rgName = '${resourcePrefix}-${environment}-rg'
var acrName = '${take(replace(toLower(resourcePrefix), '-', ''), 20)}${environment}acr'
var appInsightsName = '${resourcePrefix}-${environment}-appi'
var kvName = '${resourcePrefix}-${environment}-kv'
var identityName = '${resourcePrefix}-${environment}-id'
var sqlServerName = '${resourcePrefix}-${environment}-sql'
var sqlDbName = 'InvoiceLens'
var logWorkspaceName = '${resourcePrefix}-${environment}-law'
var appServicePlanName = '${resourcePrefix}-${environment}-plan'
var apiAppName = '${resourcePrefix}-${environment}-api'
var webAppName = '${resourcePrefix}-${environment}-web'
var caeName = '${resourcePrefix}-${environment}-cae'
var apiContainerAppName = '${resourcePrefix}-${environment}-api-ca'
var webContainerAppName = '${resourcePrefix}-${environment}-web-ca'
var workerJobName = '${resourcePrefix}-${environment}-worker-job'

module resourceGroup './modules/resource-group.bicep' = {
	scope: subscription()
	params: {
		resourceGroupName: rgName
		location: location
	}
}

module logAnalytics './modules/log-analytics.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		name: logWorkspaceName
		location: location
	}
}

module acr './modules/acr.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		name: acrName
		location: location
	}
}

module managedIdentity './modules/managed-identity.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		name: identityName
		location: location
	}
}

module keyVault './modules/key-vault.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		name: kvName
		location: location
		tenantId: tenant().tenantId
	}
}

module appInsights './modules/app-insights.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		name: appInsightsName
		location: location
		workspaceResourceId: logAnalytics.outputs.id
	}
}

module sqlServer './modules/sql-server.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		name: sqlServerName
		location: location
		adminLogin: sqlAdminLogin
		adminPassword: sqlAdminPassword
	}
}

module sqlDatabase './modules/sql-database.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		serverName: sqlServer.outputs.name
		databaseName: sqlDbName
		location: location
	}
}

module appServicePlan './modules/app-service-plan.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		name: appServicePlanName
		location: location
	}
}

module apiAppService './modules/api-app-service.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		name: apiAppName
		location: location
		appServicePlanId: appServicePlan.outputs.id
		acrServer: acr.outputs.loginServer
		apiImage: apiImage
	}
}

module webAppService './modules/web-app-service.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		name: webAppName
		location: location
		appServicePlanId: appServicePlan.outputs.id
		acrServer: acr.outputs.loginServer
		webImage: webImage
	}
}

module containerAppsEnvironment './modules/container-apps-environment.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		name: caeName
		location: location
		logAnalyticsCustomerId: logAnalytics.outputs.customerId
		logAnalyticsSharedKey: logAnalyticsSharedKey
	}
}

module containerApi './modules/container-app-api.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		name: apiContainerAppName
		location: location
		environmentId: containerAppsEnvironment.outputs.id
		acrServer: acr.outputs.loginServer
		apiImage: apiImage
	}
}

module containerWeb './modules/container-app-web.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		name: webContainerAppName
		location: location
		environmentId: containerAppsEnvironment.outputs.id
		acrServer: acr.outputs.loginServer
		webImage: webImage
	}
}

module workerContainerJob './modules/worker-container-job.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		name: workerJobName
		location: location
		managedEnvironmentId: containerAppsEnvironment.outputs.id
		acrServer: acr.outputs.loginServer
		workerImage: workerImage
	}
}

module roleAssignments './modules/role-assignments.bicep' = {
	scope: resourceGroup(resourceGroup.outputs.name)
	params: {
		principalId: managedIdentity.outputs.principalId
		keyVaultId: keyVault.outputs.id
		acrId: acr.outputs.id
	}
}

output resourceGroupName string = resourceGroup.outputs.name
