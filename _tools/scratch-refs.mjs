import fs from 'node:fs';
import path from 'node:path';
import { ROOT, listHtmlFiles, listDataFiles, read } from './lib.mjs';

const html = listHtmlFiles().map((f) => read(f));
const data = listDataFiles().map((f) => read(f));
const all = html.join('\n') + data.join('\n');

const referencedData = new Set();
for (const h of html) for (const m of h.matchAll(/\/data\/([^"?]+)/g)) referencedData.add(m[1]);
const unrefData = fs.readdirSync(path.join(ROOT, 'data')).filter((f) => !referencedData.has(f));
console.log('unreferenced data files:', unrefData);

for (const dir of ['media', 's', 'photos', 'storebox-media', 'logos', 'attachments', 'destinations', 'product', 'team', 'blogs', 'travel-journal']) {
  const refs = (all.match(new RegExp(`["'(/]${dir}/`, 'g')) || []).length;
  console.log(dir.padEnd(16), 'refs:', refs);
}
for (const f of ['css2', 'css2-1', 'css2-2', 'css2-3', 'webcopy-origin.txt', 'favicon.ico', 'favicon-32.png', 'favicon-192.png', 'apple-touch-icon.png']) {
  console.log(f.padEnd(22), 'refs:', (all.match(new RegExp(`["/]${f.replace('.', '\\.')}["?]`, 'g')) || []).length);
}
const hosts = new Map();
for (const m of all.matchAll(/(?:src|href)=\\?"(https?:\/\/[^/"\\]+)/g)) hosts.set(m[1], (hosts.get(m[1]) || 0) + 1);
console.log([...hosts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30));
