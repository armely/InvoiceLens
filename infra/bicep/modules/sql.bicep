param serverName string
param databaseName string
param location string
param adminLogin string
@secure()
param adminPassword string

module sqlServer './sql-server.bicep' = {
	params: {
		name: serverName
		location: location
		adminLogin: adminLogin
		adminPassword: adminPassword
	}
}

module sqlDatabase './sql-database.bicep' = {
	params: {
		serverName: sqlServer.outputs.name
		databaseName: databaseName
		location: location
	}
}

output serverId string = sqlServer.outputs.id
output databaseId string = sqlDatabase.outputs.id
