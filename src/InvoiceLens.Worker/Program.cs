using InvoiceLens.Worker;

var builder = Host.CreateApplicationBuilder(args);

builder.Services.AddHostedService<SyncHeartbeatWorker>();

var host = builder.Build();
host.Run();
