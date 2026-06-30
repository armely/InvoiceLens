using InvoiceLens.Application.Sync;
using InvoiceLens.Infrastructure;
using InvoiceLens.Worker.Jobs;
using InvoiceLens.Worker.Schedules;
using InvoiceLens.Worker.SyncHandlers;
using InvoiceLens.Worker;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.Configure<SyncScheduleOptions>(builder.Configuration.GetSection("SyncSchedule"));

builder.Services.AddInvoiceLensInfrastructure();

builder.Services.AddSingleton<RunInitialHydrationCommand>();
builder.Services.AddSingleton<RunIncrementalSyncCommand>();
builder.Services.AddSingleton<RunReconciliationCommand>();
builder.Services.AddSingleton<RetryFailedSyncRecordsCommand>();

builder.Services.AddHostedService<InitialInvoiceHydrationJob>();
builder.Services.AddHostedService<IncrementalInvoiceSyncJob>();
builder.Services.AddHostedService<ReconciliationJob>();
builder.Services.AddHostedService<FailedRecordRetryJob>();
builder.Services.AddHostedService<SyncHeartbeatWorker>();

var host = builder.Build();
host.Run();
