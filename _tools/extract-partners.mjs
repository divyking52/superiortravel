// One-time extraction of the current partner logos/directory from the partners page into
// content/partners.json (the editable source used by build.mjs). Usage: node _tools/extract-partners.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadPageData, write } from './lib.mjs';

const target = path.join(ROOT, 'content', 'partners.json');
if (fs.existsSync(target) && !process.argv.includes('--force')) {
  console.log('content/partners.json already exists (use --force to overwrite).');
  process.exit(0);
}

const w = loadPageData('data/partners.js');
const page = Object.values(w.__ENRICHED_IR__.pages)[0];
const html = page.sections.find((s) => s.id === 'partner-logo-wall').content;
const decode = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');

const featured = [...html.matchAll(/<div class="stp-card"><img src="([^"]+)" alt="([^"]*)" loading="lazy"><span>([^<]+)<\/span><\/div>/g)].map((m) => ({
  name: decode(m[3]),
  logo: m[1],
  alt: decode(m[2]),
  website: '',
}));

const directory = [
  ...html.matchAll(
    /<article class="stp-directory-card"><div class="stp-directory-logo"><img src="([^"]+)" alt="([^"]*)" loading="lazy"><\/div><div class="stp-directory-copy"><h2>([^<]+)<\/h2><p>([\s\S]*?)<\/p><a href="([^"]+)">Ask an advisor <span aria-hidden="true">→<\/span><\/a><\/div><\/article>/g,
  ),
].map((m) => ({ name: decode(m[3]), logo: m[1], alt: decode(m[2]), description: decode(m[4]), enquiryLink: m[5], website: '' }));

const out = {
  $comment:
    'Travel partners shown on /partners (featured logo wall + directory) and in the homepage logo rail (featured, in order). Add, edit, reorder or remove entries here, then run `node _tools/build.mjs`. `website` is optional: when set, the logo links to it in a new tab; leave empty until the client confirms the correct destination URL. Directory descriptions are partner-supplied text and are published as-is.',
  featured,
  directory,
};
write('content/partners.json', `${JSON.stringify(out, null, 2)}\n`);
console.log(`Extracted ${featured.length} featured and ${directory.length} directory partners.`);
