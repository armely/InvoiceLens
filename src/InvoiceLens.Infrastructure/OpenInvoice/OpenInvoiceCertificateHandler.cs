using System.Net;
using System.Security.Cryptography.X509Certificates;

namespace InvoiceLens.Infrastructure.OpenInvoice;

public static class OpenInvoiceCertificateHandler
{
    public static HttpClientHandler CreatePrimaryHandler(OpenInvoiceOptions options)
    {
        var handler = new HttpClientHandler
        {
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
        };

        if (!options.CertificateEnabled)
        {
            return handler;
        }

        if (string.IsNullOrWhiteSpace(options.CertificatePath))
        {
            throw new InvalidOperationException("OpenInvoice client certificate is enabled but no certificate path was configured.");
        }

        if (!File.Exists(options.CertificatePath))
        {
            throw new FileNotFoundException("OpenInvoice client certificate file was not found.", options.CertificatePath);
        }

        var certificate = string.IsNullOrWhiteSpace(options.CertificatePassword)
            ? X509CertificateLoader.LoadPkcs12FromFile(options.CertificatePath, string.Empty, X509KeyStorageFlags.EphemeralKeySet, null)
            : X509CertificateLoader.LoadPkcs12FromFile(options.CertificatePath, options.CertificatePassword, X509KeyStorageFlags.EphemeralKeySet, null);

        handler.ClientCertificates.Add(certificate);
        return handler;
    }
}
