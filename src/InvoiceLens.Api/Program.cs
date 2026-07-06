using InvoiceLens.Api.Authentication;
using InvoiceLens.Api.Middleware;
using InvoiceLens.Infrastructure;
using InvoiceLens.Infrastructure.Configuration;
using InvoiceLens.Infrastructure.LocalInvoices;
using InvoiceLens.Infrastructure.OpenInvoice;
using InvoiceLens.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Data.SqlClient;

DotEnvLoader.Load();

var builder = WebApplication.CreateBuilder(args);
builder.Configuration["ConnectionStrings:InvoiceLensDb"] = SqlConnectionStringFactory.Build();

builder.Services.AddControllers();
builder.Services.Configure<MicrosoftAuthOptions>(builder.Configuration.GetSection("InvoiceLens:Auth"));
builder.Services.AddSingleton<MicrosoftSessionTokenValidator>();
builder.Services.AddHttpClient();
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(CookieAuthenticationDefaults.AuthenticationScheme, options =>
    {
        options.Cookie.Name = ".InvoiceLens.Auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.SlidingExpiration = true;
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.LoginPath = "/api/auth/session";
        options.LogoutPath = "/api/auth/logout";
        options.Events = new CookieAuthenticationEvents
        {
            OnRedirectToLogin = context =>
            {
                if (context.Request.Path.StartsWithSegments("/api"))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                }

                context.Response.Redirect(context.RedirectUri);
                return Task.CompletedTask;
            },
            OnRedirectToAccessDenied = context =>
            {
                if (context.Request.Path.StartsWithSegments("/api"))
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    return Task.CompletedTask;
                }

                context.Response.Redirect(context.RedirectUri);
                return Task.CompletedTask;
            },
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddInvoiceLensInfrastructure(
    OpenInvoiceOptionsFactory.Create(builder.Configuration),
    CreateLocalInvoiceOptions(builder.Configuration));

var app = builder.Build();

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/", () => Results.Ok(new
{
    service = "InvoiceLens.Api",
    status = "running",
    health = "/health"
})).AllowAnonymous();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" })).AllowAnonymous();

app.MapControllers().RequireAuthorization();

using (var scope = app.Services.CreateScope())
{
    var schemaInitializer = scope.ServiceProvider.GetRequiredService<InvoiceComparisonSchemaInitializer>();
    try
    {
        await schemaInitializer.EnsureAsync();
    }
    catch (SqlException exception)
    {
        Console.Error.WriteLine("""
            InvoiceLens cannot start because SQL Server is unreachable.

            Check the root .env values for:
            - InvoiceLens__Sql__ServerHost
            - InvoiceLens__Sql__DatabaseName
            - InvoiceLens__Sql__Username
            - InvoiceLens__Sql__Password

            If you are using SQL Server Express, the host usually looks like localhost\SQLEXPRESS.
            If you are using Docker or local SQL Server, the host is often localhost,1433.
            If you are using Azure SQL, the host usually looks like your-server.database.windows.net.
            """);
        Console.Error.WriteLine(exception.Message);
        Environment.ExitCode = 1;
        return;
    }
}

app.Run();

static LocalInvoiceComparisonOptions CreateLocalInvoiceOptions(IConfiguration configuration)
{
    var localInvoices = configuration.GetSection("InvoiceLens:LocalInvoices");
    var comparison = configuration.GetSection("InvoiceLens:Comparison");

    return new LocalInvoiceComparisonOptions
    {
        Enabled = bool.TryParse(localInvoices["Enabled"], out var enabled) ? enabled : true,
        PdfFolder = localInvoices["PdfFolder"] ?? "samples/invoices/pdf",
        MetadataFolder = localInvoices["MetadataFolder"] ?? "samples/invoices/metadata",
        AutoCompareOnStartup = bool.TryParse(localInvoices["AutoCompareOnStartup"], out var autoCompare) && autoCompare,
        AmountTolerance = decimal.TryParse(comparison["AmountTolerance"], out var amountTolerance) ? amountTolerance : 0.01m,
        DateToleranceDays = int.TryParse(comparison["DateToleranceDays"], out var dateToleranceDays) ? dateToleranceDays : 0,
        RequireSupplierNumber = bool.TryParse(comparison["RequireSupplierNumber"], out var requireSupplierNumber) ? requireSupplierNumber : true
    };
}
