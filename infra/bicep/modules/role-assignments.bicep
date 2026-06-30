param principalId string
param keyVaultId string
param acrId string

resource keyVaultRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
	name: guid(keyVaultId, principalId, 'KeyVaultSecretsUser')
	scope: resource(keyVaultId, 'Microsoft.KeyVault/vaults@2023-07-01')
	properties: {
		principalId: principalId
		roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
		principalType: 'ServicePrincipal'
	}
}

resource acrRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
	name: guid(acrId, principalId, 'AcrPull')
	scope: resource(acrId, 'Microsoft.ContainerRegistry/registries@2023-07-01')
	properties: {
		principalId: principalId
		roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
		principalType: 'ServicePrincipal'
	}
}
