param name string
param location string
param tenantId string
@secure()
param sqlPassword string
@secure()
param openInvoiceHmacSigningKey string

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

resource sqlPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'sql-password'
  properties: { value: sqlPassword }
}

resource openInvoiceHmacSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = if (openInvoiceHmacSigningKey != '') {
  parent: keyVault
  name: 'openinvoice-hmac-key'
  properties: { value: openInvoiceHmacSigningKey }
}

output id string = keyVault.id
output name string = keyVault.name
