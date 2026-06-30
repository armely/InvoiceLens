targetScope = 'subscription'

param resourceGroupName string
param location string

resource rg 'Microsoft.Resources/resourceGroups@2023-07-01' = {
  name: resourceGroupName
  location: location
}

output name string = rg.name
output id string = rg.id
