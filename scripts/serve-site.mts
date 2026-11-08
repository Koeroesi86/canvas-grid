import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const siteDir = join(root, 'site');
const buildDir = join(root, 'build');

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.map': 'application/json',
};

/** Maps a request path to a file: `/build/*` serves the local build, everything else the site. */
export const resolveFile = (pathname: string) => {
  const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  const [base, rest] = relative.startsWith(`build${sep}`) ? [buildDir, relative.slice('build'.length + 1)] : [siteDir, relative];
  const file = resolve(base, rest || 'index.html');
  return file.startsWith(base + sep) ? file : undefined;
};

const send = async (pathname: string, response: import('node:http').ServerResponse) => {
  const file = resolveFile(pathname);
  const isFile = file !== undefined && (await stat(file).then(stats => stats.isFile(), () => false));
  if (!file || !isFile) {
    response.writeHead(404).end('Not found');
    return;
  }

  response.writeHead(200, { 'content-type': contentTypes[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(response);
};

const port = Number(process.env.SITE_PORT || '4000');

createServer((request, response) => {
  send(new URL(request.url ?? '/', 'http://localhost').pathname, response).catch(() => response.writeHead(400).end('Bad request'));
}).listen(port, () => {
  console.log(`Site preview on http://localhost:${port}`);
  console.log(`Grid from unpkg by default; http://localhost:${port}/?local uses ./build (run npm run build first)`);
});
