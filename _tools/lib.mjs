import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const SITE_ORIGIN = 'https://superiortravel.com';

export const read = (p) => fs.readFileSync(path.isAbsolute(p) ? p : path.join(ROOT, p), 'utf8');
export const write = (p, s) => {
  const abs = path.isAbsolute(p) ? p : path.join(ROOT, p);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  for (let attempt = 1; ; attempt++) {
    try {
      fs.writeFileSync(abs, s);
      return;
    } catch (err) {
      // Windows can briefly lock files (indexer/antivirus); retry before giving up.
      if (attempt >= 5 || !['UNKNOWN', 'EBUSY', 'EPERM'].includes(err.code)) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200 * attempt);
    }
  }
};
export const readJson = (p) => JSON.parse(read(p));

/** Evaluates a Storebox page-data file (data/*.js) and returns the window globals it sets. */
export function loadPageData(file) {
  const win = {};
  vm.runInNewContext(read(file), { window: win });
  return win;
}

/** Serializes window globals back into the same `window.X=...;` format Storebox emits. */
export function serializePageData(win) {
  return Object.entries(win)
    .map(([k, v]) => `window.${k}=${typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v)};`)
    .join('\n') + '\n';
}

export function listDataFiles() {
  return fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.js')).map((f) => path.join('data', f));
}

/** Every HTML page in the mirror, excluding the contact-N.html query-string duplicates. */
export function listHtmlFiles({ includeContactDuplicates = false } = {}) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (['_tools', 'content', 'node_modules', 'media', 'assets', 's', 'data', 'admin'].includes(e.name) && dir === '') continue;
        walk(rel);
      } else if (/\.html?$/.test(e.name)) {
        if (!includeContactDuplicates && /^contact-\d+\.html$/.test(e.name)) continue;
        out.push(rel);
      }
    }
  };
  walk('');
  return out;
}

export const stripTags = (html) =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

export const escapeHtml = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
