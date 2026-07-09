param name string
param location string
param skuName string = 'P1v3'
param skuTier string = 'PremiumV3'
param skuCapacity int = 1

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: name
  location: location
  sku: {
    name: skuName
    tier: skuTier
    capacity: skuCapacity
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

output id string = plan.id
