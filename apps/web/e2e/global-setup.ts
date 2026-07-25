import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const host = '127.0.0.1';
const port = 4300;
const publicDirectory = resolve('dist/web/browser');
const indexPath = resolve(publicDirectory, 'index.html');

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function resolveRequestPath(requestUrl: string): string | undefined {
  const pathname = decodeURIComponent(
    new URL(requestUrl, 'http://localhost').pathname,
  );
  const candidate = resolve(publicDirectory, `.${pathname}`);

  if (
    candidate !== publicDirectory &&
    !candidate.startsWith(`${publicDirectory}${sep}`)
  ) {
    return undefined;
  }

  return existsSync(candidate) && statSync(candidate).isFile()
    ? candidate
    : indexPath;
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  const server = createServer((request, response) => {
    const filePath = resolveRequestPath(request.url ?? '/');

    if (!filePath || !existsSync(filePath)) {
      response.writeHead(404).end('Not found');
      return;
    }

    response.setHeader(
      'Content-Type',
      contentTypes.get(extname(filePath)) ?? 'application/octet-stream',
    );
    createReadStream(filePath)
      .on('error', () => response.writeHead(500).end('Unable to read file'))
      .pipe(response);
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, host, resolveListen);
  });

  return () =>
    new Promise<void>((resolveClose, rejectClose) => {
      server.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
}
