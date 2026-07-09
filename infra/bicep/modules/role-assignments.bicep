param principalId string
param keyVaultId string
param acrId string

var keyVaultName = last(split(keyVaultId, '/'))
var acrName = last(split(acrId, '/'))

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
	name: keyVaultName
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
	name: acrName
}

resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
	name: guid(keyVaultId, principalId, 'KeyVaultSecretsUser')
	scope: keyVault
	properties: {
		principalId: principalId
		roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
		principalType: 'ServicePrincipal'
	}
}

resource acrRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
	name: guid(acrId, principalId, 'AcrPull')
	scope: acr
	properties: {
		principalId: principalId
		roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
		principalType: 'ServicePrincipal'
	}
}
