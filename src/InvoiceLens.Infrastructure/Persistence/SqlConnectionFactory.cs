using InvoiceLens.Infrastructure.Configuration;
using Microsoft.Data.SqlClient;

namespace InvoiceLens.Infrastructure.Persistence;

internal static class SqlConnectionFactory
{
    public static SqlConnection CreateConnection()
    {
        return new SqlConnection(SqlConnectionStringFactory.Build());
    }
}
