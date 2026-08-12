targetScope = 'subscription'

param location string
param sqlLocation string = location
param appServiceLocation string = location
param environment string
param resourcePrefix string

param sqlAdminLogin string
@secure()
param sqlAdminPassword string

param authClientId string = ''
param authTenantId string = ''
param authRedirectUri string = ''
param authPostLogoutRedirectUri string = ''
param authScopes string = 'openid profile email'
param webPublicBaseUrl string = ''
param apiPublicBaseUrl string = ''
param openInvoiceHmacSigningKey string = ''
param operationsEmail string = ''

param apiImage string = 'invoicelens-api:latest'
param webImage string = 'invoicelens-web:latest'
param workerImage string = 'invoicelens-worker:latest'
param openInvoiceMockImage string = 'invoicelens-openinvoicemock:latest'

param deployAppServiceWebApi bool = true
param deployContainerAppWebApi bool = false
param deployWorkerJob bool = false
param deployOpenInvoiceMock bool = false

param appServicePlanSkuName string = 'P1v3'
param appServicePlanSkuTier string = 'PremiumV3'
param appServicePlanSkuCapacity int = 1

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
var openInvoiceMockAppName = '${resourcePrefix}-${environment}-openinvoicemock'
var webAppOrigin = webPublicBaseUrl == '' ? 'https://${webAppName}.azurewebsites.net' : webPublicBaseUrl
var apiAppOrigin = apiPublicBaseUrl == '' ? 'https://${apiAppName}.azurewebsites.net' : apiPublicBaseUrl
var openInvoiceBaseUrl = 'https://${openInvoiceMockAppName}.azurewebsites.net'
var webAppBaseUrl = '${webAppOrigin}/'
var webAppAuthRedirectUri = authRedirectUri == '' ? webAppBaseUrl : authRedirectUri
var webAppAuthPostLogoutRedirectUri = authPostLogoutRedirectUri == '' ? webAppBaseUrl : authPostLogoutRedirectUri
var caeName = '${resourcePrefix}-${environment}-cae'
var apiContainerAppName = '${resourcePrefix}-${environment}-api-ca'
var webContainerAppName = '${resourcePrefix}-${environment}-web-ca'
var workerJobName = '${resourcePrefix}-${environment}-worker-job'

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
	name: rgName
	location: location
}

module logAnalytics './modules/log-analytics.bicep' = {
	scope: rg
	params: {
		name: logWorkspaceName
		location: location
	}
}

module acr './modules/acr.bicep' = {
	scope: rg
	params: {
		name: acrName
		location: location
	}
}

module managedIdentity './modules/managed-identity.bicep' = {
	scope: rg
	params: {
		name: identityName
		location: location
	}
}

module keyVault './modules/key-vault.bicep' = {
	scope: rg
	params: {
		name: kvName
		location: location
		tenantId: tenant().tenantId
		sqlPassword: sqlAdminPassword
		keyVaultName: keyVault.outputs.name
	}
}

module appInsights './modules/app-insights.bicep' = {
	scope: rg
	params: {
		name: appInsightsName
		location: location
		workspaceResourceId: logAnalytics.outputs.id
	}
}

module sqlServer './modules/sql-server.bicep' = {
	scope: rg
	params: {
		name: sqlServerName
		location: sqlLocation
		adminLogin: sqlAdminLogin
		adminPassword: sqlAdminPassword
	}
}

module sqlDatabase './modules/sql-database.bicep' = {
	scope: rg
	params: {
		serverName: sqlServer.outputs.name
		databaseName: sqlDbName
		location: sqlLocation
	}
}

module appServicePlan './modules/app-service-plan.bicep' = {
	scope: rg
	params: {
		name: appServicePlanName
		location: appServiceLocation
		skuName: appServicePlanSkuName
		skuTier: appServicePlanSkuTier
		skuCapacity: appServicePlanSkuCapacity
	}
}

module apiAppService './modules/api-app-service.bicep' = if (deployAppServiceWebApi) {
	scope: rg
	params: {
		name: apiAppName
		location: appServiceLocation
		appServicePlanId: appServicePlan.outputs.id
		acrServer: acr.outputs.loginServer
		apiImage: apiImage
		userAssignedIdentityId: managedIdentity.outputs.id
		openInvoiceBaseUrl: openInvoiceBaseUrl
		keyVaultName: keyVault.outputs.name
		sqlServerHost: sqlServer.outputs.fullyQualifiedDomainName
		sqlDatabaseName: sqlDbName
		sqlUsername: sqlAdminLogin
		authClientId: authClientId
		authTenantId: authTenantId
		applicationInsightsConnectionString: appInsights.outputs.connectionString
	}
}

module webAppService './modules/web-app-service.bicep' = if (deployAppServiceWebApi) {
	scope: rg
	params: {
		name: webAppName
		location: appServiceLocation
		appServicePlanId: appServicePlan.outputs.id
		acrServer: acr.outputs.loginServer
		webImage: webImage
		userAssignedIdentityId: managedIdentity.outputs.id
		apiBaseUrl: apiAppOrigin
		authClientId: authClientId
		authTenantId: authTenantId
		authRedirectUri: webAppAuthRedirectUri
		authPostLogoutRedirectUri: webAppAuthPostLogoutRedirectUri
		authScopes: authScopes
	}
}

module openInvoiceMockAppService './modules/api-app-service.bicep' = if (deployOpenInvoiceMock) {
	scope: rg
	params: {
		name: openInvoiceMockAppName
		location: location
		appServicePlanId: appServicePlan.outputs.id
		acrServer: acr.outputs.loginServer
		apiImage: openInvoiceMockImage
		userAssignedIdentityId: managedIdentity.outputs.id
		keyVaultName: keyVault.outputs.name
	}
}

module containerAppsEnvironment './modules/container-apps-environment.bicep' = if (deployContainerAppWebApi || deployWorkerJob) {
	scope: rg
	params: {
		name: caeName
		location: location
		logAnalyticsCustomerId: logAnalytics.outputs.customerId
		logAnalyticsSharedKey: logAnalytics.outputs.primarySharedKey
	}
}

module containerApi './modules/container-app-api.bicep' = if (deployContainerAppWebApi) {
	scope: rg
	params: {
		name: apiContainerAppName
		location: location
		environmentId: containerAppsEnvironment!.outputs.id
		acrServer: acr.outputs.loginServer
		apiImage: apiImage
		openInvoiceBaseUrl: openInvoiceBaseUrl
		openInvoiceHmacSigningKey: openInvoiceHmacSigningKey
	}
}

module containerWeb './modules/container-app-web.bicep' = if (deployContainerAppWebApi) {
	scope: rg
	params: {
		name: webContainerAppName
		location: location
		environmentId: containerAppsEnvironment!.outputs.id
		acrServer: acr.outputs.loginServer
		webImage: webImage
		authClientId: authClientId
		authTenantId: authTenantId
		authRedirectUri: authRedirectUri
		authPostLogoutRedirectUri: authPostLogoutRedirectUri
		authScopes: authScopes
		appBaseUrl: webAppOrigin
	}
}

module workerContainerJob './modules/worker-container-job.bicep' = if (deployWorkerJob) {
	scope: rg
	params: {
		name: workerJobName
		location: location
		managedEnvironmentId: containerAppsEnvironment!.outputs.id
		acrServer: acr.outputs.loginServer
		workerImage: workerImage
		openInvoiceBaseUrl: openInvoiceBaseUrl
		openInvoiceHmacSigningKey: openInvoiceHmacSigningKey
	}
}

module roleAssignments './modules/role-assignments.bicep' = {
	scope: rg
	params: {
		principalId: managedIdentity.outputs.principalId
		keyVaultId: keyVault.outputs.id
		acrId: acr.outputs.id
	}
}

module monitoringAlerts './modules/monitoring-alerts.bicep' = if (deployAppServiceWebApi) {
	scope: rg
	params: {
		location: location
		namePrefix: '${resourcePrefix}-${environment}'
		apiResourceId: apiAppService!.outputs.id
		operationsEmail: operationsEmail
	}
}

output resourceGroupName string = rg.name
