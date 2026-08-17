using InvoiceLens.Application.Sync;
using InvoiceLens.Infrastructure;
using InvoiceLens.Infrastructure.Configuration;
using InvoiceLens.Infrastructure.LocalInvoices;
using InvoiceLens.Infrastructure.Notifications;
using InvoiceLens.Infrastructure.OpenInvoice;
using InvoiceLens.Worker.Jobs;
using InvoiceLens.Worker.Schedules;
using InvoiceLens.Worker;

DotEnvLoader.Load();

var builder = Host.CreateApplicationBuilder(args);
builder.Configuration["ConnectionStrings:InvoiceLensDb"] = SqlConnectionStringFactory.Build();

builder.Services.Configure<SyncScheduleOptions>(builder.Configuration.GetSection("SyncSchedule"));

builder.Services.AddInvoiceLensInfrastructure(
    OpenInvoiceOptionsFactory.Create(builder.Configuration),
    CreateLocalInvoiceOptions(builder.Configuration),
    CreateNotificationOptions(builder.Configuration));

builder.Services.AddHostedService<SyncOpenInvoiceInvoicesJob>();
builder.Services.AddHostedService<SyncOpenInvoiceInvoiceDetailsJob>();
builder.Services.AddHostedService<SyncOpenInvoiceAttachmentsJob>();
builder.Services.AddHostedService<PostOpenInvoiceEventsJob>();
builder.Services.AddHostedService<RetryFailedOpenInvoiceEventsJob>();
builder.Services.AddHostedService<LoadAndCompareLocalInvoicesJob>();
builder.Services.AddHostedService<SyncHeartbeatWorker>();

var host = builder.Build();
host.Run();

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

static NotificationOptions CreateNotificationOptions(IConfiguration configuration)
{
    var section = configuration.GetSection("InvoiceLens:Notifications");
    var recipients = section.GetSection("Recipients").Get<string[]>() ?? [];

    return new NotificationOptions
    {
        Enabled = bool.TryParse(section["Enabled"], out var enabled) && enabled,
        TenantId = section["TenantId"] ?? string.Empty,
        ClientId = section["ClientId"] ?? string.Empty,
        ClientSecret = section["ClientSecret"] ?? string.Empty,
        SenderUserId = section["SenderUserId"] ?? string.Empty,
        SubjectPrefix = section["SubjectPrefix"] ?? "InvoiceLens",
        Recipients = recipients
    };
}
