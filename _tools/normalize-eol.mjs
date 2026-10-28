// Converts CRLF line endings back to LF in site HTML and page-data files (production serves LF;
// the build compares page-data strings with server HTML byte-for-byte).
// Usage: node _tools/normalize-eol.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, listHtmlFiles, listDataFiles } from './lib.mjs';

let fixed = 0;
for (const rel of [...listHtmlFiles(), ...listDataFiles(), 'robots.txt', 'llms.txt']) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue;
  const buf = fs.readFileSync(abs, 'utf8');
  if (!buf.includes('\r\n')) continue;
  fs.writeFileSync(abs, buf.replace(/\r\n/g, '\n'));
  fixed++;
}
console.log(`Normalized ${fixed} file(s) to LF.`);
