using InvoiceLens.OpenInvoiceMock;
using InvoiceLens.Infrastructure.Configuration;
using InvoiceLens.Infrastructure.OpenInvoice;
using Microsoft.AspNetCore.ResponseCompression;

DotEnvLoader.Load();

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddControllers();
builder.Services.AddSingleton(OpenInvoiceOptionsFactory.Create(builder.Configuration));
builder.Services.AddSingleton<OpenInvoiceMockStore>();
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<GzipCompressionProvider>();
});
builder.Services.Configure<GzipCompressionProviderOptions>(options =>
{
    options.Level = System.IO.Compression.CompressionLevel.Fastest;
});

var app = builder.Build();

app.UseResponseCompression();
app.UseMiddleware<OpenInvoiceErrorSimulationMiddleware>();
app.UseMiddleware<OpenInvoiceSecurityMiddleware>();
app.MapControllers();

app.MapGet("/", () => Results.Ok(new { service = "InvoiceLens.OpenInvoiceMock", status = "running" }));
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.Run();
