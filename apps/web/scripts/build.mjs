import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, '..');
const distDir = join(rootDir, 'dist');
const srcDir = join(rootDir, 'src');
const publicDir = join(rootDir, 'public');
const vendorDir = join(distDir, 'vendor');

function getEnvOverrideNames() {
  const environmentName = process.env.DOTNET_ENVIRONMENT ?? process.env.ASPNETCORE_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
  const lower = environmentName.trim().toLowerCase();
  const names = [`.env.${lower}`];

  if (['development', 'dev', 'local'].includes(lower)) {
    names.push('.env.local');
  } else if (['production', 'prod'].includes(lower)) {
    names.push('.env.prod');
  } else if (['test', 'testing'].includes(lower)) {
    names.push('.env.test');
  }

  return names;
}

const envFileNames = ['.env', ...getEnvOverrideNames()];
const envFileCandidates = [join(scriptDir, '..', '..'), join(scriptDir, '..', '..', '..')]
  .flatMap((baseDir) => envFileNames.map((fileName) => join(baseDir, fileName)));

function loadDotEnvFile() {
  for (const envFilePath of envFileCandidates) {
    if (!existsSync(envFilePath)) {
      continue;
    }

    const lines = readFileSync(envFilePath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) {
        continue;
      }

      const normalized = line.startsWith('export ') ? line.slice(7).trimStart() : line;
      const separatorIndex = normalized.indexOf('=');
      if (separatorIndex <= 0) {
        continue;
      }

      const key = normalized.slice(0, separatorIndex).trim();
      let value = normalized.slice(separatorIndex + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
        value = value.slice(1, -1);
      }

      if (!(key in process.env)) {
        process.env[key] = value.replace(/\\n/g, '\n');
      }
    }
  }
}

loadDotEnvFile();

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
mkdirSync(vendorDir, { recursive: true });

const tscEntryPoint = join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc');

execFileSync(process.execPath, [tscEntryPoint, '-p', 'tsconfig.json'], {
  cwd: rootDir,
  stdio: 'inherit',
});

cpSync(join(srcDir, 'index.html'), join(distDir, 'index.html'));
cpSync(join(srcDir, 'styles.css'), join(distDir, 'styles.css'));
cpSync(join(rootDir, 'node_modules', 'chart.js', 'dist', 'chart.umd.js'), join(vendorDir, 'chart.umd.js'));

if (existsSync(publicDir)) {
  cpSync(publicDir, distDir, { recursive: true });
}

const runtimeConfig = {
  auth: {
    clientId: process.env.InvoiceLens__Auth__ClientId ?? '',
    tenantId: process.env.InvoiceLens__Auth__TenantId ?? '',
    redirectUri: process.env.InvoiceLens__Auth__RedirectUri ?? '',
    postLogoutRedirectUri: process.env.InvoiceLens__Auth__PostLogoutRedirectUri ?? '',
    scopes: (process.env.InvoiceLens__Auth__Scopes ?? 'openid profile email User.Read Mail.Send').split(' ').filter(Boolean),
  },
};

writeFileSync(join(distDir, 'runtime-config.js'), `window.InvoiceLensRuntimeConfig = ${JSON.stringify(runtimeConfig)};\n`, 'utf8');
