import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, '..', 'dist');
const port = Number(process.env.PORT ?? 4200);
const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:5106';
const envFileCandidates = [join(scriptDir, '..', '..', '.env'), join(scriptDir, '..', '..', '..', '.env')];

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
const mimeTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
]);

function sendFile(response, filePath) {
  const contentType = mimeTypes.get(extname(filePath)) ?? 'application/octet-stream';
  response.writeHead(200, { 'Content-Type': contentType });
  createReadStream(filePath).pipe(response);
}

function sendRuntimeConfig(response) {
  const runtimeConfig = {
    auth: {
      clientId: process.env.InvoiceLens__Auth__ClientId ?? '',
      tenantId: process.env.InvoiceLens__Auth__TenantId ?? '',
      redirectUri: process.env.InvoiceLens__Auth__RedirectUri ?? `${process.env.APP_BASE_URL ?? 'http://localhost:4200'}/`,
      postLogoutRedirectUri: process.env.InvoiceLens__Auth__PostLogoutRedirectUri ?? `${process.env.APP_BASE_URL ?? 'http://localhost:4200'}/`,
      scopes: (process.env.InvoiceLens__Auth__Scopes ?? 'openid profile email User.Read').split(' ').filter(Boolean),
    },
  };

  response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(`window.InvoiceLensRuntimeConfig = ${JSON.stringify(runtimeConfig)};`);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    request.on('end', () => {
      resolve(chunks.length > 0 ? Buffer.concat(chunks) : undefined);
    });

    request.on('error', reject);
  });
}

async function proxyRequest(request, response) {
  try {
    const targetUrl = new URL(request.url ?? '/', apiBaseUrl);
    const headers = new Headers();

    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value === 'string') {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        headers.set(key, value.join(','));
      }
    }

    headers.delete('host');
    headers.delete('content-length');

    const method = request.method ?? 'GET';
    const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(request);
    const proxyResponse = await fetch(targetUrl, {
      method,
      headers,
      body,
    });

    response.writeHead(proxyResponse.status, Object.fromEntries(proxyResponse.headers.entries()));
    const data = Buffer.from(await proxyResponse.arrayBuffer());
    response.end(data);
  } catch (error) {
    response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(error instanceof Error ? error.message : 'Proxy error');
  }
}

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');

  if (requestUrl.pathname === '/runtime-config.js') {
    sendRuntimeConfig(response);
    return;
  }

  if (requestUrl.pathname.startsWith('/api/') || requestUrl.pathname === '/health') {
    void proxyRequest(request, response);
    return;
  }

  let filePath = join(rootDir, decodeURIComponent(requestUrl.pathname));

  if (requestUrl.pathname === '/' || !extname(filePath)) {
    filePath = join(rootDir, 'index.html');
  }

  if (!existsSync(filePath)) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  sendFile(response, filePath);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`InvoiceLens web is running at http://0.0.0.0:${port}`);
});
