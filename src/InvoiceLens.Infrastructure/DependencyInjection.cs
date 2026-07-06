using InvoiceLens.Application.ComplianceQueue;
using InvoiceLens.Application.Audit;
using InvoiceLens.Application.InvoiceComparison;
using InvoiceLens.Application.Documents;
using InvoiceLens.Application.Invoices;
using InvoiceLens.Application.Sync;
using InvoiceLens.Application.Validation;
using InvoiceLens.Infrastructure.DocumentStreaming;
using InvoiceLens.Infrastructure.InvoiceComparison;
using InvoiceLens.Infrastructure.LocalInvoices;
using InvoiceLens.Infrastructure.OpenInvoice;
using InvoiceLens.Infrastructure.Persistence;
using InvoiceLens.Infrastructure.Persistence.Repositories;
using Microsoft.Extensions.DependencyInjection;

namespace InvoiceLens.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInvoiceLensInfrastructure(this IServiceCollection services)
    {
        return services.AddInvoiceLensInfrastructure(new OpenInvoiceOptions(), new LocalInvoiceComparisonOptions());
    }

    public static IServiceCollection AddInvoiceLensInfrastructure(this IServiceCollection services, OpenInvoiceOptions openInvoiceOptions, LocalInvoiceComparisonOptions localInvoiceOptions)
    {
        services.AddSingleton<SqlInvoiceService>();
        services.AddSingleton<IInvoiceQueries>(sp => sp.GetRequiredService<SqlInvoiceService>());
        services.AddSingleton<IQueueService>(sp => sp.GetRequiredService<SqlInvoiceService>());
        services.AddSingleton<ISyncStatusService>(sp => sp.GetRequiredService<SqlInvoiceService>());

        services.AddSingleton<IValidationRepository, ValidationRepository>();
        services.AddSingleton<IMsaContractRepository, MsaContractRepository>();
        services.AddSingleton<ValidationOrchestrator>();
        services.AddSingleton<IValidationService>(sp => sp.GetRequiredService<ValidationOrchestrator>());
        services.AddSingleton<RunInvoiceValidationCommand>();
        services.AddSingleton<GetValidationSummaryQuery>();

        services.AddSingleton<IAuditRepository, AuditRepository>();
        services.AddSingleton<AuditEventFactory>();
        services.AddSingleton<CreateAuditEntryCommand>();
        services.AddSingleton<GetAuditTrailQuery>();

        services.AddSingleton(openInvoiceOptions);
        services.AddSingleton(localInvoiceOptions);
        services.AddSingleton<LocalInvoiceMetadataReader>();
        services.AddSingleton<LocalInvoiceFileReader>();
        services.AddSingleton<InvoiceComparisonSchemaInitializer>();
        services.AddSingleton<IInvoiceComparisonService, SqlInvoiceComparisonService>();
        services.AddSingleton<OpenInvoiceSyncRepository>();
        services.AddSingleton<OpenInvoiceSyncService>();

        services.AddSingleton<HttpClient>(sp =>
        {
            var openInvoiceOptions = sp.GetRequiredService<OpenInvoiceOptions>();
            var primaryHandler = OpenInvoiceCertificateHandler.CreatePrimaryHandler(openInvoiceOptions);

            HttpMessageHandler handler = primaryHandler;
            if (openInvoiceOptions.EnableHmac)
            {
                handler = new OpenInvoiceHmacHandler(openInvoiceOptions)
                {
                    InnerHandler = primaryHandler
                };
            }

            var httpClient = new HttpClient(handler)
            {
                BaseAddress = string.IsNullOrWhiteSpace(openInvoiceOptions.BaseUrl) ? null : new Uri(openInvoiceOptions.BaseUrl, UriKind.Absolute),
                Timeout = TimeSpan.FromSeconds(Math.Max(660, openInvoiceOptions.TimeoutSeconds))
            };

            return httpClient;
        });

        services.AddSingleton<IOpenInvoiceClient, HttpOpenInvoiceClient>();
        services.AddSingleton<IDocumentQueries, DocumentStreamService>();
        services.AddSingleton<ISyncOrchestrator, OpenInvoiceSyncOrchestrator>();
        services.AddSingleton<IInvoiceListSyncHandler, DefaultInvoiceListSyncHandler>();
        services.AddSingleton<IInvoiceDetailSyncHandler, DefaultInvoiceDetailSyncHandler>();
        services.AddSingleton<IInvoiceUpsertHandler, DefaultInvoiceUpsertHandler>();
        services.AddSingleton<ISyncCheckpointHandler, DefaultSyncCheckpointHandler>();
        services.AddSingleton<InvoiceListResponseParser>();
        services.AddSingleton<InvoiceDetailXmlParser>();
        services.AddSingleton<OpenInvoicePagingService>();
        services.AddSingleton<SyncCheckpointRepository>();
        services.AddSingleton<SyncErrorRepository>();

        return services;
    }
}
