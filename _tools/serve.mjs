// Local preview server that mimics production routing: "/" -> index.htm, "/team" -> team.html,
// "/team/carol-mcparland" -> team/carol-mcparland.html. Static files missing locally (for example
// media the original website copy did not capture) are fetched from production.
// Usage: node _tools/serve.mjs [port] [--drafts]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SITE_ORIGIN } from './lib.mjs';

const args = process.argv.slice(2);
const port = Number(args.find((a) => /^\d+$/.test(a)) || 4173);
const showDrafts = args.includes('--drafts');
const types = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};
const blocked = showDrafts ? /^\/(_tools|content|\.git)(\/|$)/ : /^\/(_tools|_drafts|content|\.git)(\/|$)/;

function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath).replace(/\/+$/, '') || '/';
  if (blocked.test(clean)) return { blocked: true };
  const candidates = clean === '/' ? ['index.htm'] : [clean, `${clean}.html`];
  for (const c of candidates) {
    const abs = path.join(ROOT, c);
    if (!abs.startsWith(ROOT)) return { blocked: true };
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return { file: abs };
  }
  return {};
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const { file, blocked: isBlocked } = resolve(url.pathname);
    if (file) {
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
      fs.createReadStream(file).pipe(res);
      return;
    }
    if (!isBlocked && path.extname(url.pathname)) {
      const upstream = await fetch(`${SITE_ORIGIN}${url.pathname}${url.search}`).catch(() => null);
      if (upstream?.ok) {
        res.writeHead(200, { 'content-type': upstream.headers.get('content-type') || 'application/octet-stream' });
        res.end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
    }
    const notFound = path.join(ROOT, '404.html');
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found');
  })
  .listen(port, () => console.log(`Preview: http://localhost:${port}/${showDrafts ? ' (drafts visible under /_drafts/)' : ''}`));
