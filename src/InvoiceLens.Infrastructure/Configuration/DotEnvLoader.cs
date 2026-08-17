using System.Text;

namespace InvoiceLens.Infrastructure.Configuration;

public static class DotEnvLoader
{
    public static void Load()
    {
        foreach (var path in GetCandidatePaths())
        {
            if (!File.Exists(path))
            {
                continue;
            }

            LoadFile(path);
        }
    }

    private static IEnumerable<string> GetCandidatePaths()
    {
        var environmentName = Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? "Production";

        var fileNames = new List<string> { ".env" };
        foreach (var fileName in GetEnvironmentOverrideNames(environmentName))
        {
            if (!fileNames.Contains(fileName, StringComparer.OrdinalIgnoreCase))
            {
                fileNames.Add(fileName);
            }
        }

        var baseDirectories = new[]
        {
            AppContext.BaseDirectory,
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..")),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..")),
        };

        return baseDirectories
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .SelectMany(baseDirectory => fileNames.Select(fileName => Path.Combine(baseDirectory, fileName)))
            .Distinct(StringComparer.OrdinalIgnoreCase);
    }

    private static IEnumerable<string> GetEnvironmentOverrideNames(string environmentName)
    {
        var normalized = environmentName.Trim();
        if (string.IsNullOrWhiteSpace(normalized))
        {
            yield break;
        }

        var lower = normalized.ToLowerInvariant();
        yield return $".env.{lower}";

        if (lower is "development" or "dev" or "local")
        {
            yield return ".env.local";
            yield break;
        }

        if (lower is "production" or "prod")
        {
            yield return ".env.prod";
            yield break;
        }

        if (lower is "test" or "testing")
        {
            yield return ".env.test";
        }
    }

    private static void LoadFile(string path)
    {
        foreach (var rawLine in File.ReadLines(path, Encoding.UTF8))
        {
            var line = rawLine.Trim();

            if (string.IsNullOrWhiteSpace(line) || line.StartsWith('#'))
            {
                continue;
            }

            if (line.StartsWith("export ", StringComparison.OrdinalIgnoreCase))
            {
                line = line[7..].TrimStart();
            }

            var separatorIndex = line.IndexOf('=');
            if (separatorIndex <= 0)
            {
                continue;
            }

            var key = line[..separatorIndex].Trim();
            var value = line[(separatorIndex + 1)..].Trim();

            if (value.Length >= 2)
            {
                var first = value[0];
                var last = value[^1];
                if ((first == '"' && last == '"') || (first == '\'' && last == '\''))
                {
                    value = value[1..^1];
                }
            }

            value = value.Replace("\\n", Environment.NewLine, StringComparison.Ordinal);
            Environment.SetEnvironmentVariable(key, value);
        }
    }
}
