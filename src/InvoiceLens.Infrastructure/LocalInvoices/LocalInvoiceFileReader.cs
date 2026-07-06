namespace InvoiceLens.Infrastructure.LocalInvoices;

internal sealed class LocalInvoiceFileReader(LocalInvoiceComparisonOptions options, LocalInvoiceMetadataReader metadataReader)
{
    public async Task<IReadOnlyList<LocalInvoiceMetadataSnapshot>> DiscoverAsync(CancellationToken cancellationToken)
    {
        if (!options.Enabled)
        {
            return Array.Empty<LocalInvoiceMetadataSnapshot>();
        }

        var root = ResolveWorkspaceRoot();
        var metadataFolder = ResolvePath(root, options.MetadataFolder);
        var pdfFolder = ResolvePath(root, options.PdfFolder);
        return await metadataReader.ReadAllAsync(metadataFolder, pdfFolder, cancellationToken);
    }

    public async Task<LocalInvoiceMetadataSnapshot?> ReadByMetadataPathAsync(string metadataPath, CancellationToken cancellationToken)
    {
        var metadata = await metadataReader.ReadAsync(metadataPath, cancellationToken);
        if (metadata is null)
        {
            return null;
        }

        var root = ResolveWorkspaceRoot();
        var pdfFolder = ResolvePath(root, options.PdfFolder);
        var resolvedPdfPath = Path.Combine(pdfFolder, metadata.FileName);
        return new LocalInvoiceMetadataSnapshot(metadata, metadataPath, resolvedPdfPath);
    }

    public string ResolveMetadataPath(string fileName)
    {
        var root = Directory.GetCurrentDirectory();
        var metadataFolder = ResolvePath(root, options.MetadataFolder);
        return Path.Combine(metadataFolder, Path.ChangeExtension(fileName, ".json"));
    }

    public string ResolvePdfPath(string fileName)
    {
        var root = ResolveWorkspaceRoot();
        var pdfFolder = ResolvePath(root, options.PdfFolder);
        return Path.Combine(pdfFolder, fileName);
    }

    private static string ResolveWorkspaceRoot()
    {
        var candidates = new[]
        {
            AppContext.BaseDirectory,
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..")),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
        };

        foreach (var candidate in candidates)
        {
            if (File.Exists(Path.Combine(candidate, ".env")) || Directory.Exists(Path.Combine(candidate, "samples")))
            {
                return candidate;
            }
        }

        return Directory.GetCurrentDirectory();
    }

    private static string ResolvePath(string root, string path)
    {
        return Path.IsPathRooted(path) ? path : Path.GetFullPath(Path.Combine(root, path));
    }
}
