import fs from 'node:fs';
import path from 'node:path';
import { ROOT, listDataFiles, loadPageData } from './lib.mjs';

const kf = new Map();
const anims = new Map();
const paddings = new Map();
const minHeights = new Map();
let routes = null;
for (const f of listDataFiles()) {
  const w = loadPageData(f);
  routes ||= w.__ROUTES__;
  for (const p of Object.values(w.__ENRICHED_IR__.pages)) {
    for (const s of p.sections || []) {
      if (s.layoutId !== 'customPage') continue;
      const c = s.content || '';
      for (const m of c.matchAll(/@keyframes\s+([\w-]+)/g)) kf.set(m[1], (kf.get(m[1]) || 0) + 1);
      for (const m of c.matchAll(/animation:\s*([^;}]+)/g)) anims.set(m[1].trim(), (anims.get(m[1].trim()) || 0) + 1);
      for (const m of c.matchAll(/([.#][\w-]+(?:\s+[.#]?[\w-]+)*)\{[^}]*padding:\s*(\d{2,3})px/g)) {
        if (Number(m[2]) >= 80) paddings.set(`${m[1]} ${m[2]}`, (paddings.get(`${m[1]} ${m[2]}`) || 0) + 1);
      }
      for (const m of c.matchAll(/([.#][\w-]+(?:\s+[.#]?[\w-]+)*)\{[^}]*min-height:\s*(\d{3,4})px/g)) {
        minHeights.set(`${m[1]} ${m[2]}`, (minHeights.get(`${m[1]} ${m[2]}`) || 0) + 1);
      }
    }
  }
}
const top = (m, n = 40) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
console.log('KEYFRAMES', top(kf));
console.log('ANIMATIONS', top(anims));
console.log('BIG PADDINGS', top(paddings, 60));
console.log('MIN HEIGHTS', top(minHeights));

const missing = routes.filter((r) => {
  const p = r.path === '/' ? 'index.htm' : `${r.path.slice(1)}.html`;
  return !fs.existsSync(path.join(ROOT, p));
});
console.log('ROUTES', routes.length, 'missing locally:', missing.length);
for (const r of missing) console.log('  ', r.path, '|', r.pageId);
