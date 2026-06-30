param name string
param location string
param tenantId string

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
	name: name
	location: location
	properties: {
		tenantId: tenantId
		sku: {
			family: 'A'
			name: 'standard'
		}
		enableRbacAuthorization: true
		enabledForDeployment: false
		enabledForTemplateDeployment: false
		enabledForDiskEncryption: false
	}
}

output id string = keyVault.id
