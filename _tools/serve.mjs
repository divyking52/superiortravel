// Local preview server that mimics production routing: "/" -> index.htm, "/team" -> team.html,
// "/team/carol-mcparland" -> team/carol-mcparland.html. Usage: node _tools/serve.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib.mjs';

const port = Number(process.argv[2] || 4173);
const types = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain',
};
const blocked = /^\/(_tools|content)(\/|$)/;

function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath).replace(/\/+$/, '') || '/';
  if (blocked.test(clean)) return null;
  const candidates = clean === '/' ? ['index.htm'] : [clean, `${clean}.html`, `${clean}/index.html`];
  for (const c of candidates) {
    const abs = path.join(ROOT, c);
    if (!abs.startsWith(ROOT)) return null;
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  // The copy tool saved Google Fonts CSS as extension-less "css2" files.
  if (/^\/css2/.test(clean)) return path.join(ROOT, 'css2');
  return null;
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = resolve(url.pathname);
    if (!file) {
      const notFound = path.join(ROOT, '404.html');
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found');
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'content-type': types[ext] || (path.basename(file).startsWith('css2') ? 'text/css' : 'application/octet-stream') });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Preview: http://localhost:${port}/`));
