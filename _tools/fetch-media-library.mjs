// Saves the public file list of the Superior Travel Storebox media library to content/media-library.json.
//   STOREBOX_TOKEN=<access token> node _tools/fetch-media-library.mjs
// The token is read from the environment only and is never written to disk; the output holds public URLs only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEBSITE = 'ae19d98f-7028-4345-a14a-6cc77fa221e7';
const MEDIA_HOST = 'https://media.storebox.ai';
const token = process.env.STOREBOX_TOKEN;
if (!token) {
  console.error('Set STOREBOX_TOKEN to a Storebox access token first.');
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

const abs = (p) => (p ? (p.startsWith('http') ? p : `${MEDIA_HOST}${p}`) : undefined);
const media = items
  .map((m) => ({
    id: m.id,
    filename: m.filename,
    mimetype: m.mimetype,
    width: m.width,
    height: m.height,
    url: abs(m.file_url),
    thumbnails: Object.fromEntries(Object.entries(m.thumbnails || {}).map(([k, v]) => [k, abs(v)])),
  }))
  .sort((a, b) => a.filename.localeCompare(b.filename));

const out = path.join(ROOT, 'content', 'media-library.json');
fs.writeFileSync(out, JSON.stringify({ website: WEBSITE, host: MEDIA_HOST, fetched: new Date().toISOString(), count: media.length, media }, null, 1) + '\n');
console.log(`${media.length} media items saved to ${path.relative(ROOT, out)}.`);
