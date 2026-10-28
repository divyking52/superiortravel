// Maps every image used by the standalone file to its copy in a Storebox media library and saves the
// result to content/media-map.json (original image link -> library link). The library copies are the
// files exported to "all assets/" by _tools/export-assets.mjs; each upload is matched to its exported
// file by filename and exact byte size.
//   STOREBOX_TOKEN=<access token> node _tools/map-media-library.mjs [websiteId]
// The token is read from the environment only and is never written to disk.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEBSITE = process.argv[2] || 'f5483de0-ab5a-4232-b97d-8c1e6a2ad083';
const MEDIA_HOST = 'https://media.storebox.ai';
const EXPORT = path.join(ROOT, 'all assets');
const token = process.env.STOREBOX_TOKEN;
if (!token) {
  console.error('Set STOREBOX_TOKEN to a Storebox access token first.');
  process.exit(1);
}
if (!fs.existsSync(path.join(EXPORT, 'manifest.csv'))) {
  console.error('Run node _tools/export-assets.mjs first; the mapping needs all assets/manifest.csv.');
  process.exit(1);
}

const items = [];
let url = `https://admin.storebox.ai/api/websites/${WEBSITE}/media/?page_size=100&page=1`;
while (url) {
  const res = await fetch(url, { headers: { accept: 'application/json', authorization: `Bearer ${token}`, origin: 'https://app.storebox.ai', referer: 'https://app.storebox.ai/' } });
  if (!res.ok) {
    console.error(`Media library request failed: HTTP ${res.status}`);
    process.exit(1);
  }
  const page = await res.json();
  items.push(...page.results);
  url = page.next;
}
const link = (p) => (p.startsWith('http') ? p : `${MEDIA_HOST}${p}`);

// manifest.csv: file,size_kb,source,used_on (quoted CSV)
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') row.push(cell), (cell = '');
    else if (c === '\n') row.push(cell.replace(/\r$/, '')), rows.push(row), (row = []), (cell = '');
    else cell += c;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows;
}
const [, ...rows] = parseCsv(fs.readFileSync(path.join(EXPORT, 'manifest.csv'), 'utf8'));
const exported = rows.filter((r) => r[0]).map(([file, , sources]) => ({ file, name: path.basename(file).toLowerCase(), bytes: fs.statSync(path.join(EXPORT, file)).size, sources: sources.split(' | ') }));

const norm = (n) => n.toLowerCase().replace(/\.jpeg$/, '.jpg');
const byNameSize = new Map(items.map((m) => [`${norm(m.filename)}|${m.file_size}`, m]));
const bySize = new Map();
for (const m of items) bySize.set(m.file_size, bySize.has(m.file_size) ? null : m);
const used = new Set();
const map = {};
const unmatched = [];
for (const x of exported) {
  let m = byNameSize.get(`${norm(x.name)}|${x.bytes}`);
  if (!m || used.has(m.id)) m = bySize.get(x.bytes);
  if (!m || used.has(m.id)) {
    unmatched.push(x.file);
    continue;
  }
  used.add(m.id);
  for (const s of x.sources) map[s] = link(m.file_url);
}

const out = path.join(ROOT, 'content', 'media-map.json');
fs.writeFileSync(out, JSON.stringify({ website: WEBSITE, generated: new Date().toISOString(), libraryItems: items.length, mapped: Object.keys(map).length, unmatchedFiles: unmatched, map }, null, 1) + '\n');
console.log(`${items.length} library items; ${exported.length - unmatched.length} of ${exported.length} exported images matched; ${Object.keys(map).length} image links mapped.`);
if (unmatched.length) console.log(`Not found in the library (${unmatched.length}):\n  ${unmatched.join('\n  ')}`);
const extra = items.filter((m) => !used.has(m.id));
if (extra.length) console.log(`Library items not matched to an exported image (${extra.length}): ${extra.map((m) => m.filename).join(', ')}`);
