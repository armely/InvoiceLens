using InvoiceLens.Application.ComplianceQueue;
using InvoiceLens.Application.Documents;
using InvoiceLens.Application.Invoices;
using InvoiceLens.Application.Sync;
using InvoiceLens.Application.Validation;
using InvoiceLens.Infrastructure.DocumentStreaming;
using InvoiceLens.Infrastructure.OpenInvoice;
using InvoiceLens.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;

namespace InvoiceLens.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInvoiceLensInfrastructure(this IServiceCollection services)
    {
        services.AddSingleton<InMemoryInvoiceService>();
        services.AddSingleton<IInvoiceQueries>(sp => sp.GetRequiredService<InMemoryInvoiceService>());
        services.AddSingleton<IQueueService>(sp => sp.GetRequiredService<InMemoryInvoiceService>());
        services.AddSingleton<IValidationService>(sp => sp.GetRequiredService<InMemoryInvoiceService>());
        services.AddSingleton<ISyncStatusService>(sp => sp.GetRequiredService<InMemoryInvoiceService>());

        services.AddSingleton<IDocumentQueries, DocumentStreamService>();
        services.AddSingleton<IOpenInvoiceClient, OpenInvoiceClient>();
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
