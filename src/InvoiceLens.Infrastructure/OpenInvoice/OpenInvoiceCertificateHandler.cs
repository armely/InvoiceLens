using System.Net;
using System.Security.Cryptography;
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

        // Avoid EphemeralKeySet on Windows Schannel client auth; persisted keys prevent
        // "platform does not support ephemeral keys" handshake failures.
        var keyStorageFlags = X509KeyStorageFlags.PersistKeySet | X509KeyStorageFlags.MachineKeySet | X509KeyStorageFlags.Exportable;
        X509Certificate2 certificate;

        try
        {
            certificate = string.IsNullOrWhiteSpace(options.CertificatePassword)
                ? X509CertificateLoader.LoadPkcs12FromFile(options.CertificatePath, string.Empty, keyStorageFlags, null)
                : X509CertificateLoader.LoadPkcs12FromFile(options.CertificatePath, options.CertificatePassword, keyStorageFlags, null);
        }
        catch (CryptographicException)
        {
            // Fallback for environments where MachineKeySet is not permitted.
            var fallbackFlags = X509KeyStorageFlags.PersistKeySet | X509KeyStorageFlags.UserKeySet | X509KeyStorageFlags.Exportable;
            certificate = string.IsNullOrWhiteSpace(options.CertificatePassword)
                ? X509CertificateLoader.LoadPkcs12FromFile(options.CertificatePath, string.Empty, fallbackFlags, null)
                : X509CertificateLoader.LoadPkcs12FromFile(options.CertificatePath, options.CertificatePassword, fallbackFlags, null);
        }

        handler.ClientCertificates.Add(certificate);
        return handler;
    }
}
