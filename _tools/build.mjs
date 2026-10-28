// Applies the editable content in /content to the site: navigation, travel-category pages, agent
// sections, hotel pages (published) and private draft previews, partner logos, copy corrections,
// external-link attributes, the site enhancement assets, search index and sitemap.
// Every change is applied identically to the server-rendered HTML and the Storebox page data so
// hydration stays consistent. Safe to run repeatedly. Usage: node _tools/build.mjs
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT, SITE_ORIGIN, read, write, readJson, loadPageData, serializePageData, listDataFiles, stripTags, escapeHtml } from './lib.mjs';
import { renderCategoryPage, renderAdvisorsBlock, renderHomeStyleLinks, renderHotelPage, renderAgentCard, wrapMarker } from './templates.mjs';

const TODAY = new Date().toISOString().slice(0, 10);
const MANIFEST = '_tools/.generated.json';
const report = { warnings: [], corrections: new Map(), externalLinks: new Map(), generated: [], drafts: [], notes: [] };
const warn = (m) => report.warnings.push(m);
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const htmlFileFor = (route) => (route === '/' ? 'index.htm' : `${route.slice(1)}.html`);
const dataFileFor = (route) => `data/${route === '/' ? 'home' : route.slice(1).replace(/\//g, '--')}.js`;
const clone = (o) => JSON.parse(JSON.stringify(o));

const categoriesCfg = readJson('content/categories.json');
const agentsCfg = readJson('content/agents.json');
const hotelsCfg = readJson('content/hotels.json');
const partnersCfg = readJson('content/partners.json');
const correctionsCfg = readJson('content/text-corrections.json');

// ---------------------------------------------------------------------------------------------
// Remove output of the previous build so unpublished items disappear.
const previous = exists(MANIFEST) ? readJson(MANIFEST) : { files: [], routes: [] };
for (const f of previous.files) if (exists(f)) fs.rmSync(path.join(ROOT, f));
if (exists('_drafts')) fs.rmSync(path.join(ROOT, '_drafts'), { recursive: true });
const previousRoutes = new Set(previous.routes);

// ---------------------------------------------------------------------------------------------
// Load every page (HTML + page data).
const pages = new Map();
for (const dataFile of listDataFiles()) {
  const win = loadPageData(dataFile);
  const route = win.__ROUTE_PATH__;
  const htmlFile = htmlFileFor(route);
  if (!exists(htmlFile)) {
    warn(`Page data ${dataFile} has no HTML file (${htmlFile}); skipped.`);
    continue;
  }
  const html = read(htmlFile);
  pages.set(route, { route, dataFile, htmlFile, win, html, origData: read(dataFile), origHtml: html });
}
const pageObj = (p) => Object.values(p.win.__ENRICHED_IR__.pages)[0];
const customSections = (p) => (pageObj(p).sections || []).filter((s) => s.layoutId === 'customPage');
const mainCustomSection = (p) => customSections(p).find((s) => s.id !== 'site-planning-cta');

/** Replaces an HTML content string (customPage `content`, blog body) in both the page data and the identical server HTML. */
function setCustomContent(page, section, next, holder = section) {
  const prev = holder.content;
  if (prev === next) return true;
  const count = page.html.split(prev).length - 1;
  if (count !== 1) {
    warn(`${page.route}: section ${section.id} not found verbatim in HTML (${count}x); left unchanged.`);
    return false;
  }
  page.html = page.html.replace(prev, () => next);
  holder.content = next;
  return true;
}
/** Every raw-HTML content block on a page: customPage sections and blog post bodies. */
const htmlBlocks = (p) =>
  (pageObj(p).sections || []).flatMap((s) =>
    s.layoutId === 'customPage' ? [{ section: s, holder: s }] : s.layoutId === 'blogPost' && typeof s.blogPost?.content === 'string' ? [{ section: s, holder: s.blogPost }] : [],
  );

// ---------------------------------------------------------------------------------------------
// Visible-text helpers.
const reactEsc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
const altEsc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const jsonEsc = (s) => JSON.stringify(s).slice(1, -1);
const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function mapHtmlVisible(html, fn) {
  let out = '';
  let last = 0;
  const re = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<[^>]+>/gi;
  let m;
  while ((m = re.exec(html))) {
    out += fn(html.slice(last, m.index));
    let tag = m[0];
    if (/^<script\b[^>]*application\/ld\+json/i.test(tag)) {
      const open = tag.indexOf('>') + 1;
      const close = tag.lastIndexOf('</');
      tag = tag.slice(0, open) + fn(tag.slice(open, close)) + tag.slice(close);
    } else if (!/^<(script|style|!--)/i.test(tag)) {
      tag = tag.replace(/(\s(?:alt|title|aria-label|placeholder|content)=")([^"]*)(")/g, (_, a, v, z) => a + fn(v) + z);
    }
    out += tag;
    last = re.lastIndex;
  }
  return out + fn(html.slice(last));
}

const IR_SKIP_KEYS = new Set(['href', 'src', 'url', 'slug', 'id', 'pageId', 'path', 'layoutId', 'file_url', 'og_image', 'canonical', 'srcset', 'website_id', 'mimetype', 'filename']);
function mapIrStrings(node, fn, key = '') {
  if (typeof node === 'string') {
    if (IR_SKIP_KEYS.has(key) || /^(https?:|\/|#|mailto:|tel:)/.test(node)) return node;
    return node.includes('<') ? mapHtmlVisible(node, fn) : fn(node);
  }
  if (Array.isArray(node)) return node.map((v) => mapIrStrings(v, fn, key));
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) node[k] = mapIrStrings(node[k], fn, k);
  }
  return node;
}

// ---------------------------------------------------------------------------------------------
// 1. Copy corrections.
const rules = correctionsCfg.rules.map((r) => {
  const variants = [[r.find, r.replace]];
  for (const enc of [reactEsc, altEsc, jsonEsc]) {
    const v = [enc(r.find), enc(r.replace)];
    if (!variants.some((x) => x[0] === v[0])) variants.push(v);
  }
  const make = (s) => (r.match === 'word' ? new RegExp(`(?<![\\w-])${reEsc(s)}(?![\\w-])`, 'g') : new RegExp(reEsc(s), 'g'));
  return { ...r, variants: variants.map(([f, t]) => [make(f), t]) };
});
for (const page of pages.values()) {
  const active = rules.filter((r) => !(r.exclude || []).some((x) => page.route === x || page.route.startsWith(`${x}/`)));
  const fn = (text) => {
    let out = text;
    for (const r of active) {
      for (const [re, to] of r.variants) {
        out = out.replace(re, () => {
          const key = `${r.group}: “${r.find}” → “${r.replace}”`;
          report.corrections.set(key, (report.corrections.get(key) || 0) + 1);
          return to;
        });
      }
    }
    return out;
  };
  page.html = mapHtmlVisible(page.html, fn);
  for (const k of ['__ENRICHED_IR__', '__ROUTES__']) page.win[k] = mapIrStrings(page.win[k], fn);
}

// 1b. Specialty chip labels on the team directory and profile pages.
const labelMap = Object.fromEntries(Object.entries(correctionsCfg.specialtyLabels).filter(([k]) => !k.startsWith('$')));
for (const page of pages.values()) {
  if (!(page.route === '/team' || page.route.startsWith('/team/'))) continue;
  const used = new Set();
  const visit = (node) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.specialties)) {
      for (const s of node.specialties) {
        if (typeof s.title === 'string' && labelMap[s.title]) (used.add(s.title), (s.title = labelMap[s.title]));
        else if (s.title?.text && labelMap[s.title.text]) (used.add(s.title.text), (s.title.text = labelMap[s.title.text]));
      }
    }
    Object.values(node).forEach(visit);
  };
  visit(page.win.__ENRICHED_IR__.pages);
  for (const old of used) {
    page.html = page.html.split(`>${reactEsc(old)}<`).join(`>${reactEsc(labelMap[old])}<`);
    const key = `Specialty label: “${old}” → “${labelMap[old]}”`;
    report.corrections.set(key, (report.corrections.get(key) || 0) + 1);
  }
}

// ---------------------------------------------------------------------------------------------
// 2. Agents (profile data from the team page) and optimized portraits.
const teamPage = pages.get('/team');
const agents = new Map();
for (const s of pageObj(teamPage).sections) {
  for (const it of s.items || []) {
    const slug = (it.link?.href || '').split('/').pop();
    const thumbs = [160, 320, 480].every((w) => exists(`media/agents/${slug}-${w}.webp`))
      ? { 160: `/media/agents/${slug}-160.webp`, 320: `/media/agents/${slug}-320.webp`, 480: `/media/agents/${slug}-480.webp` }
      : null;
    // Owner cards are wide and use purpose-made landscape images; only directory cards get the portrait files.
    if (s.id === 'team-directory' && thumbs && it.avatarMedia?.src && it.avatarMedia.src !== thumbs[480]) {
      teamPage.html = teamPage.html.split(`src="${it.avatarMedia.src}"`).join(`src="${thumbs[480]}"`);
      it.avatarMedia.src = thumbs[480];
    }
    const bio = it.bio?.text || '';
    const sentences = bio.match(/[^.!?]+[.!?]["”']?(?=\s|$)/g) || [];
    let lead = '';
    for (const s of sentences) {
      if (lead.length >= 60 || (lead && `${lead} ${s.trim()}`.length > 220)) break;
      lead = lead ? `${lead} ${s.trim()}` : s.trim();
    }
    const shortBio = lead.length > 40 ? (lead.length <= 220 ? lead : `${lead.slice(0, 210).replace(/\s+\S*$/, '')}…`) : '';
    const loc = typeof it.location === 'object' ? it.location?.text : it.location;
    agents.set(slug, {
      slug,
      name: it.name?.text,
      role: it.role?.text || '',
      location: loc || '',
      bio,
      shortBio,
      avatar: it.avatarMedia?.src,
      thumbs,
      specialtyLabels: (it.specialties || []).map((x) => (typeof x.title === 'string' ? x.title : x.title?.text)).filter(Boolean),
      profileUrl: it.link?.href,
      contactUrl: `/contact?agent=${slug}`,
    });
  }
}
for (const a of agentsCfg.agents) {
  if (!agents.has(a.slug)) warn(`content/agents.json: ${a.slug} has no profile on /team.`);
  else if (a.clientName) report.notes.push(`Agent name: client brief says “${a.clientName}”, published profile says “${agents.get(a.slug).name}”. Confirm spelling.`);
  if (!agents.get(a.slug)?.shortBio) report.notes.push(`Agent ${a.slug}: team-card bio is not a usable sentence (“${agents.get(a.slug)?.bio}”); category cards show listed specialties only. Ask the agent for a one-sentence bio.`);
}

// ---------------------------------------------------------------------------------------------
// 3. Categories.
const cats = categoriesCfg.categories.filter((c) => c.status === 'published');
for (const c of cats) {
  c.url = c.page === 'new' ? `/${c.slug}` : c.page;
  for (const s of c.agents || []) if (!agents.has(s)) throw new Error(`Category ${c.id}: unknown agent ${s}`);
  if (c.page !== 'new' && !pages.has(c.page)) throw new Error(`Category ${c.id}: page ${c.page} does not exist`);
}
for (const c of categoriesCfg.categories.filter((x) => x.status !== 'published')) report.notes.push(`Category ${c.title} is unpublished (status: ${c.status}).`);
const catById = new Map(cats.map((c) => [c.id, c]));
const navOrder = categoriesCfg.navigation.columns.flatMap((col) => col.items).filter((id) => catById.has(id));
const orderedCats = [...navOrder.map((id) => catById.get(id)), ...cats.filter((c) => !navOrder.includes(c.id))];

const typeFor = (route) =>
  route.startsWith('/blogs/') ? 'Blog' :
  route.startsWith('/travel-journal/') ? 'Travel Journal' :
  route.startsWith('/destinations') ? 'Destination' :
  route.startsWith('/team') ? 'Advisor' :
  route.startsWith('/product/') || route === '/packages' ? 'Offer' :
  /sandals|luxury-hotels-resorts|resort/.test(route) ? 'Hotels & Resorts' :
  cats.some((c) => c.url === route) ? 'Trip Type' : 'Page';
const cleanTitle = (t = '') => t.replace(/\s*\|\s*Superior Travel( Consultants)?\s*$/i, '').trim();
const pageTitle = (p) => cleanTitle(pageObj(p).seo?.title || pageObj(p).title || (p.win.__ROUTES__ || []).find((r) => r.path === p.route)?.title || p.route);
const pageDescription = (p) => pageObj(p).seo?.description || '';

function relatedItems(c) {
  return (c.related || []).map((url) => {
    const p = pages.get(url);
    if (!p) throw new Error(`Category ${c.id}: related URL ${url} does not exist on the site`);
    return { url, title: pageTitle(p), excerpt: pageDescription(p), type: typeFor(url) };
  });
}

// 3a. Advisor sections on existing pages that act as a category's landing page.
const advisorRe = /<!--st:advisors:[\w-]+-->[\s\S]*?<!--\/st:advisors:[\w-]+-->/g;
for (const page of pages.values()) {
  const s = mainCustomSection(page);
  if (s && s.content.includes('<!--st:advisors:')) setCustomContent(page, s, s.content.replace(advisorRe, ''));
}
for (const c of cats.filter((x) => x.page !== 'new' && x.agents?.length)) {
  const page = pages.get(c.page);
  const s = mainCustomSection(page);
  setCustomContent(page, s, s.content + renderAdvisorsBlock({ category: c, agents: c.agents.map((a) => agents.get(a)) }));
}

// 3b. Homepage: link every trip type under the four image cards.
{
  const home = pages.get('/');
  const s = mainCustomSection(home);
  let content = s.content.replace(/<!--st:more-styles-->[\s\S]*?<!--\/st:more-styles-->/, '');
  const start = content.indexOf('<section class="styles" id="home-styles">');
  const end = content.indexOf('</section>', start);
  if (start < 0 || !content.slice(0, end).endsWith('</div>')) warn('Home: could not locate the travel-styles section; trip-type links not added.');
  else {
    const at = end - '</div>'.length;
    content = content.slice(0, at) + renderHomeStyleLinks(orderedCats.filter((c) => !c.existing)) + content.slice(at);
    setCustomContent(home, s, content);
  }
}

// ---------------------------------------------------------------------------------------------
// 4. Partners (partners page logo wall + directory, homepage logo rail).
const enc = (s) => escapeHtml(s).replace(/'/g, '&#x27;');
const newTab = (url) => ` href="${enc(url)}" target="_blank" rel="noopener noreferrer"`;
function replaceRegion(content, name, re, html) {
  const markerRe = new RegExp(`<!--st:${name}-->[\\s\\S]*?<!--/st:${name}-->`);
  if (markerRe.test(content)) return content.replace(markerRe, () => wrapMarker(name, html));
  if (!re.test(content)) {
    warn(`Partners: region ${name} not found.`);
    return content;
  }
  return content.replace(re, () => wrapMarker(name, html));
}
{
  const page = pages.get('/partners');
  const s = customSections(page).find((x) => x.id === 'partner-logo-wall');
  const featured = `<div class="stp-grid">${partnersCfg.featured
    .map((p) => (p.website
      ? `<a class="stp-card"${newTab(p.website)}><img src="${enc(p.logo)}" alt="${enc(p.alt)}" loading="lazy"><span>${enc(p.name)}</span><span class="st-vh"> (opens in a new tab)</span></a>`
      : `<div class="stp-card"><img src="${enc(p.logo)}" alt="${enc(p.alt)}" loading="lazy"><span>${enc(p.name)}</span></div>`))
    .join('')}</div>`;
  const directory = `<div class="stp-directory-grid">${partnersCfg.directory
    .map((p) => `<article class="stp-directory-card"><div class="stp-directory-logo"><img src="${enc(p.logo)}" alt="${enc(p.alt)}" loading="lazy"></div><div class="stp-directory-copy"><h2>${enc(p.name)}</h2><p>${enc(p.description)}</p><a href="${enc(p.enquiryLink)}">Ask an advisor <span aria-hidden="true">→</span></a>${p.website ? `<a${newTab(p.website)}>Visit website<span class="st-vh"> (opens in a new tab)</span></a>` : ''}</div></article>`)
    .join('')}</div>`;
  let content = replaceRegion(s.content, 'partners-featured', /<div class="stp-grid">(?:<div class="stp-card">[\s\S]*?<\/div>)*<\/div>/, featured);
  content = replaceRegion(content, 'partners-directory', /<div class="stp-directory-grid">(?:<article class="stp-directory-card">[\s\S]*?<\/article>)*<\/div>/, directory);
  setCustomContent(page, s, content);

  const home = pages.get('/');
  const hs = mainCustomSection(home);
  const img = (p, clone) => (clone
    ? `<span aria-hidden="true" data-partner-clone="true"><img alt="" loading="lazy" src="${enc(p.logo)}"/></span>`
    : `<span role="listitem"><img alt="${enc(p.alt)}" loading="lazy" src="${enc(p.logo)}"/></span>`);
  const rail = `<div class="logos-viewport"><div aria-label="Superior Travel partner brands" class="logos" role="list">${partnersCfg.featured.map((p) => img(p, false)).join('')}${partnersCfg.featured.map((p) => img(p, true)).join('')}</div></div><button type="button" class="st-rail-toggle" data-st-rail-toggle aria-pressed="false">Pause logo animation</button>`;
  setCustomContent(home, hs, replaceRegion(hs.content, 'partners-rail', /<div class="logos-viewport"><div[^>]*class="logos"[^>]*>(?:<img[^>]*>)*<\/div><\/div>/, rail));
  const missing = [...partnersCfg.featured, ...partnersCfg.directory].filter((p) => !p.website).map((p) => p.name);
  report.notes.push(`Partner logos without a confirmed website link (logos stay unlinked until the client supplies URLs): ${[...new Set(missing)].join(', ')}.`);
}

// ---------------------------------------------------------------------------------------------
// 5. External links in custom content open in a new tab.
function externalize(html, route) {
  return html.replace(/<a\b([^>]*?)>/gi, (tag, attrs) => {
    const href = (attrs.match(/\bhref="([^"]+)"/) || [])[1];
    if (!href || !/^https?:\/\//i.test(href)) return tag;
    let host;
    try { host = new URL(href).host; } catch { return tag; }
    if (/(^|\.)superiortravel\.com$/i.test(host)) return tag;
    const list = report.externalLinks.get(href) || new Set();
    list.add(route);
    report.externalLinks.set(href, list);
    let next = attrs;
    if (!/\btarget=/.test(next)) next += ' target="_blank"';
    if (/\brel="/.test(next)) {
      next = next.replace(/\brel="([^"]*)"/, (_, v) => `rel="${[...new Set([...v.split(/\s+/).filter(Boolean), 'noopener', 'noreferrer'])].join(' ')}"`);
    } else next += ' rel="noopener noreferrer"';
    return `<a${next}>`;
  });
}
for (const page of pages.values()) {
  for (const { section, holder } of htmlBlocks(page)) setCustomContent(page, section, externalize(holder.content, page.route), holder);
}

// 5b. Internal links to legacy paths that production 301-redirects to /blogs/<slug> point straight at the target.
const linkFixes = new Map();
for (const page of pages.values()) {
  for (const { section, holder } of htmlBlocks(page)) {
    const next = holder.content.replace(/href="\/([a-z0-9-]+)(#[^"]*)?"/g, (m, slug, hash = '') => {
      if (pages.has(`/${slug}`) || !pages.has(`/blogs/${slug}`)) return m;
      linkFixes.set(`/${slug} → /blogs/${slug}`, (linkFixes.get(`/${slug} → /blogs/${slug}`) || 0) + 1);
      return `href="/blogs/${slug}${hash}"`;
    });
    setCustomContent(page, section, next, holder);
  }
}
const LINK_FIX_LOG = '_tools/reports/link-fixes.json';
const loggedFixes = exists(LINK_FIX_LOG) ? readJson(LINK_FIX_LOG) : {};
for (const [k, v] of linkFixes) loggedFixes[k] = (loggedFixes[k] || 0) + v;
write(LINK_FIX_LOG, `${JSON.stringify(loggedFixes, null, 2)}\n`);
report.linkFixes = new Map(Object.entries(loggedFixes));

// ---------------------------------------------------------------------------------------------
// 6. Hotels: published pages and private draft previews.
const hotelRequired = (h) => {
  const missing = [];
  if (!h.overview?.trim()) missing.push('overview');
  if (!h.location?.area) missing.push('location');
  const photos = (h.photos || []).filter((p) => p.src);
  if (!photos.length) missing.push('approved photography');
  if (photos.some((p) => !p.alt)) missing.push('photo alt text');
  if (photos.some((p) => !p.approved)) missing.push('photo approval/credit confirmation');
  for (const o of h.offers || []) if (!o.validUntil) missing.push(`expiry date for offer “${o.title}”`);
  if (h.specialist && !agents.has(h.specialist)) missing.push(`valid specialist (unknown: ${h.specialist})`);
  return missing;
};
const publishedHotels = [];
const draftHotels = [];
for (const h of hotelsCfg.hotels) {
  const missing = hotelRequired(h);
  const expired = (h.offers || []).filter((o) => o.validUntil && o.validUntil < TODAY).map((o) => o.title);
  if (expired.length) report.notes.push(`${h.name}: expired offers hidden: ${expired.join(', ')}.`);
  if (h.status === 'published' && !missing.length) publishedHotels.push({ ...h, url: `/${h.slug}` });
  else {
    if (h.status === 'published') warn(`${h.name} is marked published but is missing: ${missing.join(', ')}. Kept as draft.`);
    draftHotels.push({ ...h, missing });
  }
}

// ---------------------------------------------------------------------------------------------
// 7. Header navigation (all pages): Trip Types mega menu + published hotels under Featured Resorts.
const nav = categoriesCfg.navigation;
const megaColumns = nav.columns
  .map((col) => ({ title: col.title, items: col.items.filter((id) => catById.has(id)).map((id) => ({ text: catById.get(id).title, link: { href: catById.get(id).url } })) }))
  .filter((col) => col.items.length);
function updateHeader(win) {
  const items = win.__ENRICHED_IR__?.header?.center?.navbarItems?.navbarItems;
  if (!items) return;
  const trip = items.find((i) => i.text === nav.menuLabel);
  if (trip) {
    trip.link = { href: nav.menuHref };
    trip.mega = { ...(trip.mega || {}), columns: clone(megaColumns) };
  }
  const featured = items.find((i) => i.text === 'Featured Travel');
  const col = featured?.mega?.columns?.find((c) => c.title === 'Featured Resorts');
  if (col) {
    col.items = col.items.filter((i) => !i._generated).concat(publishedHotels.map((h) => ({ text: h.name, link: { href: h.url }, _generated: true })));
  }
}
for (const page of pages.values()) updateHeader(page.win);

// ---------------------------------------------------------------------------------------------
// 8. Generated pages (category landing pages, published hotels) from the Luxury Escapes shell.
const template = pages.get('/luxury');
const templateSection = mainCustomSection(template);
const DEFAULT_OG = 'https://cdn1.gttwl.net/attachments/global/1491412022_original.jpeg?h=1260&w=2400&fm=webp';

function generatePage({ route, pageId, title, description, content, ogImage = DEFAULT_OG, extraHead = '', draft = false, dataDir = 'data', breadcrumb }) {
  const win = clone(template.win);
  const tPage = pageObj(template);
  const page = clone(tPage);
  const sectionId = `${pageId}-customPageSection`;
  page.slug = route;
  page.seo = { title: `${title} | Superior Travel Consultants`, description, og_image: ogImage, canonical: '' };
  page.sections = page.sections.map((s) => (s.id === templateSection.id ? { ...s, id: sectionId, content } : s));
  win.__ENRICHED_IR__.pages = { [pageId]: page };
  win.__PAGE_ID__ = pageId;
  win.__ROUTE_PATH__ = route;
  if (draft) win.__ST_DRAFT__ = true;

  const fullTitle = `${title} | Superior Travel Consultants`;
  const url = `${SITE_ORIGIN}${route}`;
  const a = (s) => escapeHtml(s);
  let html = template.html;
  html = html.replace(templateSection.content, () => content);
  html = html.replace(`data-section-id="${templateSection.id}"`, `data-section-id="${sectionId}"`);
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${a(fullTitle)}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*"\/>/, `<meta name="description" content="${a(description)}"/>`);
  html = html.replace(/<meta property="og:title" content="[^"]*"\/>/, `<meta property="og:title" content="${a(fullTitle)}"/>`);
  html = html.replace(/<meta property="og:description" content="[^"]*"\/>/, `<meta property="og:description" content="${a(description)}"/>`);
  html = html.replace(/<meta property="og:url" content="[^"]*"\/>/, `<meta property="og:url" content="${a(url)}"/>`);
  html = html.replace(/<meta property="og:image" content="[^"]*"\/>/, `<meta property="og:image" content="${a(ogImage)}"/>`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*"\/>/, `<meta name="twitter:title" content="${a(fullTitle)}"/>`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*"\/>/, `<meta name="twitter:description" content="${a(description)}"/>`);
  html = html.replace(/<meta name="twitter:image" content="[^"]*"\/>/, `<meta name="twitter:image" content="${a(ogImage)}"/>`);
  html = html.replace(/<link rel="canonical" href="[^"]*"\/>/, draft ? '<meta name="robots" content="noindex, nofollow"/>' : `<link rel="canonical" href="${a(url)}"/>`);
  const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o, null, 2)}</script>`;
  html = html.replace(/<script type="application\/ld\+json">\{\s*"@context": "https:\/\/schema.org",\s*"@type": "WebPage"[\s\S]*?<\/script>/, () => ld({ '@context': 'https://schema.org', '@type': 'WebPage', url, name: fullTitle, description }));
  html = html.replace(/<script type="application\/ld\+json">\{"@context":"https:\/\/schema.org","@type":"BreadcrumbList"[\s\S]*?<\/script>/, () =>
    `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE_ORIGIN }, ...breadcrumb.map((b, i) => ({ '@type': 'ListItem', position: i + 2, name: b.name, ...(b.url ? { item: `${SITE_ORIGIN}${b.url}` } : {}) }))] })}</script>${extraHead}`);
  if (/\/luxury"|Luxury Escapes \| Superior/.test(html.slice(0, html.indexOf('<body')))) throw new Error(`Template leftovers in generated head for ${route}`);

  const dataFile = draft ? `_drafts/data/${pageId}.js` : dataFileFor(route);
  const htmlFile = draft ? `_drafts/${route.replace(/^\/_drafts\//, '')}.html` : htmlFileFor(route);
  const rec = { route, dataFile, htmlFile, win, html, origData: '', origHtml: '', generated: true, draft };
  return rec;
}

const generated = [];
for (const c of cats.filter((x) => x.page === 'new')) {
  const content = renderCategoryPage({
    category: c,
    agents: (c.agents || []).map((s) => agents.get(s)),
    related: relatedItems(c),
    hotels: c.includePublishedHotels ? publishedHotels.map((h) => ({ ...h, locationLabel: [h.location?.area, h.location?.country].filter(Boolean).join(', ') })) : [],
    allCategories: orderedCats,
  });
  generated.push(generatePage({ route: c.url, pageId: `page-${c.slug}`, title: c.title, description: c.intro, content, breadcrumb: [{ name: c.title }] }));
}

const hotelContact = hotelsCfg.defaults.contact;
function hotelJsonLd(h) {
  const o = { '@context': 'https://schema.org', '@type': 'Hotel', name: h.name, url: `${SITE_ORIGIN}${h.url}` };
  if (h.overview) o.description = h.overview.split(/\n{2,}/)[0];
  const photos = (h.photos || []).filter((p) => p.src);
  if (photos.length) o.image = photos.map((p) => (p.src.startsWith('http') ? p.src : `${SITE_ORIGIN}${p.src}`));
  const addr = { '@type': 'PostalAddress' };
  if (h.location?.address) addr.streetAddress = h.location.address;
  if (h.location?.area) addr.addressLocality = h.location.area;
  if (h.location?.country) addr.addressCountry = h.location.country;
  o.address = addr;
  return `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
}
for (const h of publishedHotels) {
  const content = renderHotelPage({ hotel: h, specialist: h.specialist ? agents.get(h.specialist) : null, contact: hotelContact, draft: '', missing: [], today: TODAY });
  const desc = h.overview.split(/\n{2,}/)[0].slice(0, 155);
  generated.push(generatePage({ route: h.url, pageId: `hotel-${h.slug}`, title: h.name, description: desc, content, ogImage: h.photos[0].src, extraHead: hotelJsonLd(h), breadcrumb: [{ name: 'Featured Luxury Hotels & Resorts', url: '/luxury-hotels-resorts' }, { name: h.name }] }));
}

const drafts = [];
const sample = readJson('_tools/fixtures/hotel-template-sample.json');
for (const h of [...draftHotels, { ...sample, missing: [], isSample: true }]) {
  const label = h.isSample
    ? 'TEMPLATE SAMPLE — placeholder data for layout review only. Not for publication.'
    : `DRAFT PREVIEW — not published, not indexed. Status: ${h.status}.`;
  const content = renderHotelPage({ hotel: h, specialist: h.specialist ? agents.get(h.specialist) : null, contact: hotelContact, draft: label, missing: h.missing, today: TODAY });
  drafts.push(generatePage({ route: `/_drafts/hotels/${h.slug}`, pageId: `hotel-${h.slug}`, title: h.name, description: `Draft preview: ${h.name}`, content, draft: true, breadcrumb: [{ name: h.name }] }));
  if (!h.isSample) report.drafts.push({ name: h.name, missing: h.missing, notes: h.notes });
}

// ---------------------------------------------------------------------------------------------
// 9. Routes registry (all pages), enhancement assets, skip link, cache-busting.
const baseRoutes = (pages.get('/').win.__ROUTES__ || []).filter((r) => !previousRoutes.has(r.path));
const newRoutes = generated.map((g) => ({ path: g.route, pageId: g.win.__PAGE_ID__, title: pageObj(g).seo.title }));
const allRoutes = [...baseRoutes, ...newRoutes];
const everyPage = [...pages.values(), ...generated, ...drafts];
for (const p of everyPage) p.win.__ROUTES__ = clone(allRoutes);

const cssAsset = read('assets/st-site.css');
const jsAsset = read('assets/st-site.js');
const assetHead = `<link rel="stylesheet" href="/assets/st-site.css?v=${hash(cssAsset)}" data-st-asset/>`;
const assetScript = `<script defer src="/assets/st-site.js?v=${hash(jsAsset)}" data-st-asset></script>`;
const skipLink = '<a class="st-skip-link" href="#main-content" data-st-asset>Skip to main content</a>';

for (const p of everyPage) {
  let html = p.html.replace(/<link [^>]*data-st-asset\/>\n|<script [^>]*data-st-asset><\/script>\n|\n<a class="st-skip-link"[^>]*data-st-asset>[^<]*<\/a>/g, '');
  html = html.replace('</head>', `${assetHead}\n</head>`);
  html = html.replace(/<body([^>]*)>/, (m) => `${m}\n${skipLink}`);
  const data = serializePageData(p.win);
  html = html.replace(/<script defer src="\/[^"]*data\/[^"?]+\.js\?v=[^"]*"><\/script>/, `<script defer src="/${p.dataFile.replace(/\\/g, '/')}?v=${hash(data)}"></script>`);
  html = html.replace('<script type="module" src="/assets/hydrate', `${assetScript}\n<script type="module" src="/assets/hydrate`);
  p.html = html;
  p.data = data;
}

// Sanity check: customPage content must still appear verbatim exactly once.
for (const p of everyPage) {
  for (const s of customSections(p)) {
    const n = p.html.split(s.content).length - 1;
    if (n !== 1 && !['/privacy', '/terms'].includes(p.route)) warn(`${p.route}: customPage ${s.id} appears ${n}x in HTML after build.`);
  }
}

// ---------------------------------------------------------------------------------------------
// 10. Search index + agent directory data.
const TEXT_SKIP = new Set([...IR_SKIP_KEYS, 'layoutId', 'variant', 'align', 'background', 'contrast', 'tone', 'eyebrow', 'mimetype', 'thumbnails', 'og_image', 'faq_schema', 'source', 'metadata']);
function collectText(node, key = '', out = []) {
  if (typeof node === 'string') {
    if (TEXT_SKIP.has(key) || /^(https?:|\/|#|mailto:|tel:)/.test(node) || !/\s/.test(node.trim())) return out;
    out.push(node.includes('<') ? stripTags(node) : node);
  } else if (Array.isArray(node)) node.forEach((v) => collectText(v, key, out));
  else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) collectText(v, k, out);
  return out;
}
const hubDates = new Map();
for (const r of ['/blogs', '/travel-journal']) {
  for (const it of pageObj(pages.get(r)).sections.find((s) => s.layoutId === 'hubList')?.items || []) hubDates.set(it.url, (it.published_at || '').slice(0, 10));
}
const kwRes = cats.map((c) => ({ id: c.id, res: (c.keywords || []).map((k) => new RegExp(`\\b${reEsc(k)}\\b`, 'gi')) }));
const categorize = (title, desc, body) =>
  kwRes
    .filter(({ res }) => {
      const head = res.reduce((n, re) => n + (`${title} ${desc}`.match(re) || []).length, 0);
      const inBody = res.reduce((n, re) => n + (body.match(re) || []).length, 0);
      return head > 0 || inBody >= 3;
    })
    .map((x) => x.id);

const searchEntries = [];
for (const p of [...pages.values(), ...generated]) {
  if (p.route.startsWith('/_drafts')) continue;
  const po = pageObj(p);
  const sections = (po.sections || []).filter((s) => s.id !== 'site-planning-cta');
  const title = pageTitle(p);
  const desc = pageDescription(p);
  let body = collectText(sections).join(' ').replace(/\s+/g, ' ').trim();
  const limit = p.route.startsWith('/destinations/') ? 700 : 3500;
  body = body.slice(0, limit);
  let c = categorize(title, desc, body);
  const cat = cats.find((x) => x.url === p.route);
  if (cat) c = [...new Set([cat.id, ...c])];
  if (p.route.startsWith('/team/')) {
    // Advisors are only tagged with the client-supplied trip-type assignments, never inferred ones.
    const slug = p.route.split('/').pop();
    c = cats.filter((x) => (x.agents || []).includes(slug)).map((x) => x.id);
  } else if (p.route === '/team') c = [];
  searchEntries.push({ u: p.route, t: title, k: typeFor(p.route), d: desc.slice(0, 220), c, ...(hubDates.get(p.route) ? { p: hubDates.get(p.route) } : {}), b: body });
}
const searchIndex = { v: 1, built: TODAY, categories: Object.fromEntries(cats.map((c) => [c.id, { t: c.title, u: c.url }])), entries: searchEntries };
const agentDirectory = {
  categories: orderedCats.filter((c) => c.agents?.length).map((c) => ({ id: c.id, title: c.title, url: c.url, agents: c.agents })),
  agents: [...agents.values()].map((a) => ({ slug: a.slug, name: a.name, role: a.role, specialties: a.specialtyLabels, profile: a.profileUrl })),
};

// ---------------------------------------------------------------------------------------------
// 11. Sitemap: production URLs + newly published pages.
const prodSitemap = read('_tools/prod-sitemap.xml');
const escXml = (s) => s.replace(/&(?!amp;|lt;|gt;|quot;|apos;)/g, '&amp;');
let sitemap = prodSitemap.replace(/<loc>([^<]*)<\/loc>/g, (_, v) => `<loc>${escXml(v)}</loc>`).replace(/<image:loc>([^<]*)<\/image:loc>/g, (_, v) => `<image:loc>${escXml(v)}</image:loc>`);
const existingLocs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
const additions = generated.filter((g) => !existingLocs.has(`${SITE_ORIGIN}${g.route}`)).map((g) => `  <url>\n    <loc>${SITE_ORIGIN}${g.route}</loc>\n    <lastmod>${TODAY}</lastmod>\n  </url>\n`);
sitemap = sitemap.replace('</urlset>', `${additions.join('')}</urlset>`);

// ---------------------------------------------------------------------------------------------
// 12. Write output.
const written = [];
const out = (file, content) => {
  const abs = path.join(ROOT, file);
  if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8') === content) return;
  write(file, content);
  written.push(file);
};
for (const p of pages.values()) {
  if (p.data !== p.origData) out(p.dataFile, p.data);
  if (p.html !== p.origHtml) out(p.htmlFile, p.html);
}
const manifest = { files: [], routes: generated.map((g) => g.route) };
for (const g of generated) {
  out(g.dataFile, g.data);
  out(g.htmlFile, g.html);
  manifest.files.push(g.dataFile, g.htmlFile);
  report.generated.push(g.route);
}
for (const d of drafts) {
  out(d.dataFile, d.data);
  out(d.htmlFile, d.html);
}
out('assets/search-index.json', JSON.stringify(searchIndex));
out('assets/st-agents.json', JSON.stringify(agentDirectory));
out('sitemap.xml', sitemap);
write(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

// ---------------------------------------------------------------------------------------------
// 13. Report.
const lines = [];
lines.push(`# Build report (${TODAY})`, '');
lines.push('Generated by `node _tools/build.mjs` from the files in `/content`. Re-run after every content change.', '');
lines.push('## Published generated pages', '', ...report.generated.map((r) => `- ${r}`), '');
lines.push('## Trip type → advisors', '');
for (const c of orderedCats) lines.push(`- **${c.title}** (${c.url})${c.agents?.length ? `: ${c.agents.map((s) => agents.get(s).name).join(', ')}` : ''}`);
lines.push('', '## Hotel and resort listings (unpublished drafts)', '', 'Preview with `node _tools/serve.mjs --drafts` at `/_drafts/hotels/<slug>`.', '');
for (const d of report.drafts) lines.push(`- **${d.name}** — missing: ${d.missing.join(', ') || 'none'}${d.notes ? `. Note: ${d.notes}` : ''}`);
lines.push('', '## Copy corrections (verified after build across all page HTML)', '', '| Group | Original | Corrected | Original remaining | Corrected present |', '|---|---|---|---|---|');
for (const r of rules) {
  let remaining = 0;
  let present = 0;
  for (const p of pages.values()) {
    if ((r.exclude || []).some((x) => p.route === x || p.route.startsWith(`${x}/`))) continue;
    const visible = [];
    mapHtmlVisible(p.html, (t) => (visible.push(t), t));
    const text = visible.join('\n');
    for (const [re] of r.variants) remaining += (text.match(new RegExp(re.source, 'g')) || []).length;
    for (const v of new Set([r.replace, reactEsc(r.replace), altEsc(r.replace)])) present += text.split(v).length - 1;
  }
  lines.push(`| ${r.group} | ${r.find.replace(/\|/g, '\\|')} | ${r.replace.replace(/\|/g, '\\|')} | ${remaining} | ${present} |`);
}
for (const [k, v] of report.corrections) if (k.startsWith('Specialty label')) lines.push(`- ${k} (this run: ${v})`);
lines.push('', 'Specialty chips are normalized via `specialtyLabels` in content/text-corrections.json.');
lines.push('', '## Internal links updated to skip production 301 redirects', '');
if (!report.linkFixes.size) lines.push('- None.');
for (const [k, v] of report.linkFixes) lines.push(`- ${k} (${v} link${v > 1 ? 's' : ''})`);
lines.push('', '## External links (open in a new tab; confirm with client)', '');
for (const [href, routes] of [...report.externalLinks.entries()].sort()) lines.push(`- ${href} — on ${[...routes].slice(0, 4).join(', ')}${routes.size > 4 ? ` +${routes.size - 4} more` : ''}`);
lines.push('', '## Items needing client confirmation', '', ...report.notes.map((n) => `- ${n}`));
lines.push('', '## Warnings', '', ...(report.warnings.length ? report.warnings.map((w) => `- ${w}`) : ['- None']));
write('_tools/reports/build-report.md', `${lines.join('\n')}\n`);

console.log(`Pages: ${pages.size} existing, ${generated.length} generated, ${drafts.length} draft previews.`);
console.log(`Files written: ${written.length}. Search entries: ${searchEntries.length}.`);
if (report.warnings.length) console.log(`Warnings (${report.warnings.length}):\n- ${report.warnings.join('\n- ')}`);
