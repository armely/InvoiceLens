using System.Net;
using InvoiceLens.Infrastructure.Persistence;

namespace InvoiceLens.Api.Middleware;

public class ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
{
    public async Task Invoke(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (DatabaseSchemaException exception)
        {
            logger.LogError(exception, "Database schema error for request {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { error = "The database is not initialized." });
        }
        catch (DataStoreUnavailableException exception)
        {
            logger.LogError(exception, "Data store unavailable for request {Path}", context.Request.Path);
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { error = "The data store is currently unavailable." });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception for request {Path}", context.Request.Path);
            context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred." });
        }
    }
}
