param serverName string
param databaseName string
param location string

resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' existing = {
  name: serverName
}

resource database 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: databaseName
  location: location
  sku: {
    name: 'S0'
    tier: 'Standard'
  }
}

output id string = database.id
