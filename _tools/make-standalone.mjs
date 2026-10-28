// Builds standalone/superior-travel.html: the whole site (every published page) in one file with
// inline CSS/JS and hash routing (#/team, #/blogs/<slug>, …). Page content is rendered from the
// Storebox page data, compressed (gzip, base64) and decompressed in the browser.
// Run after `node _tools/build.mjs`. Usage: node _tools/make-standalone.mjs
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { ROOT, SITE_ORIGIN, readJson, write, listDataFiles, loadPageData, escapeHtml as e } from './lib.mjs';

const index = readJson('assets/search-index.json');
const catCfg = readJson('content/categories.json');

// ---------------------------------------------------------------------------------------------
// Helpers
const tx = (v) => (v == null ? '' : typeof v === 'string' ? v : typeof v.text === 'string' ? v.text : '');
const abs = (src) => (!src ? '' : src.startsWith('/') && !src.startsWith('//') ? `${SITE_ORIGIN}${src}` : src);
const AGENT_IMG = /\/media\/agents\/([a-z-]+)-\d+\.webp/;
const imgSrc = (src) => {
  const m = (src || '').match(AGENT_IMG);
  return m ? `st-agent-img:${m[1]}` : abs(src);
};
const hrefAttr = (href) => {
  if (!href) return '';
  if (/^(tel:|mailto:|#)/.test(href)) return `href="${e(href)}"`;
  if (href.startsWith('/') && !href.startsWith('//')) return `href="#${e(href)}"`;
  const own = href.match(/^https?:\/\/(?:www\.)?superiortravel\.com(\/[^"]*)?$/i);
  if (own) return `href="#${e(own[1] || '/')}"`;
  return `href="${e(href)}" target="_blank" rel="noopener noreferrer"`;
};
const button = (b, cls = '') => {
  const href = b?.link?.href || b?.href;
  const label = tx(b?.text ? b : b?.label) || tx(b);
  return href && label ? `<a class="sx-btn ${cls}" ${hrefAttr(href)}>${e(label)}</a>` : '';
};
const img = (m, extra = '') => (m?.src ? `<img src="${e(imgSrc(m.src))}" alt="${e(m.alt || '')}" loading="lazy" decoding="async"${extra}>` : '');
const head = (s, h1) => {
  const t = tx(s.title);
  const level = h1 ? 'h1' : 'h2';
  return `${tx(s.eyebrow) ? `<span class="sx-kicker">${e(tx(s.eyebrow))}</span>` : ''}${t ? `<${level}>${e(t)}</${level}>` : ''}${tx(s.subtitle) ? `<p class="sx-sub">${e(tx(s.subtitle))}</p>` : ''}${tx(s.description) ? `<p class="sx-lead">${e(tx(s.description))}</p>` : ''}`;
};
const wrap = (s, inner, cls = '') => `<section class="sx ${cls}"${s.id ? ` id="${e(s.id)}"` : ''}><div class="sx-wrap">${inner}</div></section>`;
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');
const list = (arr) => (arr?.length ? `<ul class="sx-list">${arr.map((x) => `<li>${e(tx(x))}</li>`).join('')}</ul>` : '');

// Advisor data (corrected team page) and client-supplied trip-type assignments.
const cats = catCfg.navigation.columns.flatMap((c) => c.items).map((id) => catCfg.categories.find((c) => c.id === id)).filter((c) => c?.status === 'published');
const catUrl = (c) => (c.page === 'new' ? `/${c.slug}` : c.page);
const catsByAgent = new Map();
for (const c of cats) for (const s of c.agents || []) catsByAgent.set(s, [...(catsByAgent.get(s) || []), c]);
const agentImages = {};
for (const f of fs.readdirSync(path.join(ROOT, 'media/agents'))) {
  const m = f.match(/^([a-z-]+)-160\.webp$/);
  if (m) agentImages[m[1]] = `data:image/webp;base64,${fs.readFileSync(path.join(ROOT, 'media/agents', f)).toString('base64')}`;
}

// ---------------------------------------------------------------------------------------------
// Section renderers (Storebox layouts → static HTML)
const R = {
  hero(s, first) {
    const bg = s.background?.media?.src || (Array.isArray(s.media) ? s.media[0]?.src : s.media?.src);
    return `<section class="sx sx-hero"${bg ? ` style="--bg:url('${e(abs(bg))}')"` : ''}><div class="sx-wrap">${head(s, first)}<div class="sx-actions">${button(s.primaryButton, 'light')}${button(s.secondaryButton, 'ghost')}</div></div></section>`;
  },
  'grid.cards'(s, first) {
    return wrap(s, `${head(s, first)}<ul class="sx-cards">${(s.items || [])
      .map((it) => {
        const href = it.link?.href || it.button?.link?.href;
        return `<li class="sx-card">${img(it.media)}<div><h3>${href ? `<a ${hrefAttr(href)}>${e(tx(it.title))}</a>` : e(tx(it.title))}</h3>${tx(it.description) ? `<p>${e(tx(it.description))}</p>` : ''}</div></li>`;
      })
      .join('')}</ul>`);
  },
  'grid.icons'(s, first) {
    return wrap(s, `${head(s, first)}<ul class="sx-cards sx-plain">${(s.items || []).map((it) => `<li class="sx-card"><div><h3>${e(tx(it.title))}</h3><p>${e(tx(it.description))}</p></div></li>`).join('')}</ul>`, 'alt');
  },
  hubList(s, first) {
    return wrap(s, `${head(s, first)}<ul class="sx-cards">${(s.items || [])
      .map((it) => {
        const fi = it.featured_image || it.metadata?.featured_image || it.metadata?.og_image;
        const src = typeof fi === 'string' ? fi : fi?.thumbnails?.medium || fi?.file_url || fi?.url;
        return `<li class="sx-card">${src ? `<img src="${e(abs(src))}" alt="" loading="lazy" decoding="async">` : ''}<div><span class="sx-meta">${e(fmtDate(it.published_at))}</span><h3><a ${hrefAttr(it.url)}>${e(it.title)}</a></h3><p>${e(it.excerpt || '')}</p></div></li>`;
      })
      .join('')}</ul>`);
  },
  blogPost(s) {
    const b = s.blogPost || {};
    const fi = b.metadata?.featured_image;
    const src = fi?.thumbnails?.large || fi?.file_url;
    const hasH1 = /<h1[\s>]/i.test(b.content || '');
    return `<article class="sx sx-article"><div class="sx-wrap narrow"><p class="sx-meta"><a href="#/blogs">Blog</a> · ${e(fmtDate(b.published_at))}</p>${hasH1 ? '' : `<h1>${e(b.title)}</h1>`}${src ? `<img class="sx-feature" src="${e(abs(src))}" alt="" decoding="async">` : ''}<div class="sx-prose">${b.content || ''}</div></div></article>`;
  },
  contact(s, first) {
    return wrap(s, `<div class="sx-split"><div>${head(s, first)}<div class="sx-actions">${button(s.primaryButton)}${button(s.secondaryButton, 'ghost-dark')}</div></div>
<form class="sx-form" data-mailto-form novalidate>
<p class="sx-note">This form opens your email app with your message addressed to inquiries@superiortravel.com. To use the online form instead, visit <a href="${SITE_ORIGIN}/contact" target="_blank" rel="noopener noreferrer">superiortravel.com/contact</a>.</p>
<div class="sx-field"><label for="cf-name">Full name *</label><input id="cf-name" name="name" autocomplete="name" required><p class="sx-error" data-error-for="name"></p></div>
<div class="sx-field"><label for="cf-email">Email *</label><input id="cf-email" name="email" type="email" autocomplete="email" required><p class="sx-error" data-error-for="email"></p></div>
<div class="sx-field"><label for="cf-phone">Phone (optional)</label><input id="cf-phone" name="phone" type="tel" autocomplete="tel"></div>
<div class="sx-field"><label for="cf-dates">Approximate travel dates (optional)</label><input id="cf-dates" name="dates" placeholder="For example: October 2027 or flexible"></div>
<div class="sx-field full"><label for="cf-subject">Subject *</label><input id="cf-subject" name="subject" required><p class="sx-error" data-error-for="subject"></p></div>
<div class="sx-field full"><label for="cf-message">Message *</label><textarea id="cf-message" name="message" rows="5" required></textarea><p class="sx-error" data-error-for="message"></p></div>
<button class="sx-btn" type="submit">Write my email</button><p class="sx-status" role="status" aria-live="polite"></p></form></div>`);
  },
  trustBar(s) {
    const items = s.shareable?.socialProof?.items || [];
    return wrap(s, `${tx(s.eyebrow) ? `<span class="sx-kicker">${e(tx(s.eyebrow))}</span>` : ''}<ul class="sx-badges">${items.map((i) => `<li>${e(i.title)}</li>`).join('')}</ul>`, 'tight');
  },
  'steps.grid'(s, first) {
    return wrap(s, `${head(s, first)}<ol class="sx-cards sx-plain">${(s.steps || []).map((st) => `<li class="sx-card"><div><span class="sx-kicker">${e(tx(st.eyebrow))}</span><h3>${e(tx(st.title))}</h3><p>${e(tx(st.description))}</p></div></li>`).join('')}</ol>`, 'alt');
  },
  'testimonials.grid'(s, first) {
    return wrap(s, `${head(s, first)}<ul class="sx-cards sx-plain">${(s.items || []).map((t) => `<li class="sx-card"><blockquote><p>“${e(tx(t.content))}”</p><footer>— ${e(tx(t.author))}${tx(t.role) ? `, ${e(tx(t.role))}` : ''}</footer></blockquote></li>`).join('')}</ul>`);
  },
  'travel.trip-collection'(s, first) {
    return wrap(s, `${head(s, first)}<ul class="sx-cards">${(s.trips || [])
      .map((t) => `<li class="sx-card">${img(t.media)}<div><span class="sx-kicker">${e(t.supplier || '')}</span><h3>${t.link?.href ? `<a ${hrefAttr(t.link.href)}>${e(tx(t.title))}</a>` : e(tx(t.title))}</h3><p>${e(tx(t.description))}</p><p class="sx-meta">${e([t.duration, t.route].filter(Boolean).join(' · '))}</p>${t.priceText ? `<p><strong>${e(t.priceText)}</strong></p>` : ''}</div></li>`)
      .join('')}</ul>${s.summaryNote ? `<p class="sx-note">${e(s.summaryNote)}</p>` : ''}`);
  },
  'packages.services'(s, first) {
    return wrap(s, `${head(s, first)}<ul class="sx-cards sx-plain">${(s.packages || []).map((p) => `<li class="sx-card"><div><span class="sx-kicker">${e(p.category || '')}</span><h3>${e(tx(p.name))}</h3><p>${e(tx(p.description))}</p>${button(p.button)}</div></li>`).join('')}</ul>`, 'alt');
  },
  'travel.trip-overview'(s, first) {
    const media = Array.isArray(s.media) ? s.media[0] : s.media;
    return wrap(s, `<div class="sx-split"><div>${s.supplier ? `<span class="sx-kicker">${e(s.supplier)}</span>` : ''}<${first ? 'h1' : 'h2'}>${e(tx(s.title))}</${first ? 'h1' : 'h2'}><p class="sx-lead">${e(tx(s.description))}</p>${s.route ? `<p class="sx-meta">${e(s.route)}</p>` : ''}${s.priceText ? `<p><strong>${e(s.priceText)}</strong></p>` : ''}${(s.facts || []).length ? `<dl class="sx-facts">${s.facts.map((f) => `<div><dt>${e(f.label)}</dt><dd>${e(f.value)}</dd></div>`).join('')}</dl>` : ''}<div class="sx-actions">${button(s.primaryButton)}</div></div><div>${img(media)}</div></div>
${(s.highlights || []).length ? `<h2>Highlights</h2>${list(s.highlights)}` : ''}${(s.bookingTerms || []).length ? `<h2>Booking terms</h2>${list(s.bookingTerms)}` : ''}
${(s.inquiryContacts || []).length ? `<h2>Ask about this trip</h2><ul class="sx-cards sx-plain">${s.inquiryContacts.map((c) => `<li class="sx-card"><div><h3>${e(c.name)}</h3><p>${e(c.role || '')}</p><p>${c.email ? `<a href="mailto:${e(c.email)}">${e(c.email)}</a>` : ''}${c.phone ? ` · <a href="tel:${e(c.phone.replace(/[^\d+]/g, ''))}">${e(c.phone)}</a>` : ''}</p></div></li>`).join('')}</ul>` : ''}
${s.publishedFlyer?.src ? `<h2>Published flyer</h2>${img(s.publishedFlyer, ' class="sx-flyer"')}` : ''}`);
  },
  'travel.trip-journey'(s, first) {
    return wrap(s, `${head(s, first)}<ol class="sx-timeline">${(s.itinerary || []).map((d) => `<li><span class="sx-kicker">${e(d.day || '')}</span><h3>${e(tx(d.title))}</h3><p>${e(tx(d.description))}</p></li>`).join('')}</ol>`, 'alt');
  },
  'travel.trip-facts'(s, first) {
    return wrap(s, `${head(s, first)}<div class="sx-cards sx-plain">${(s.groups || []).map((g) => `<div class="sx-card"><div><h3>${e(tx(g.title))}</h3><p>${e(tx(g.description))}</p>${list(g.items)}</div></div>`).join('')}</div>`);
  },
  faq(s, first) {
    return wrap(s, `${head(s, first)}<div class="sx-faq">${(s.items || []).map((q) => `<details><summary>${e(tx(q.question))}</summary><p>${e(tx(q.answer))}</p></details>`).join('')}</div>`, 'alt');
  },
  'teams.detailed'(s, first, ctx) {
    const filter = ctx.route === '/team' && s.id === 'team-directory'
      ? `<div class="sx-filter" data-team-filter role="search" aria-label="Find an advisor"><div><label for="tf-name">Search by name</label><input id="tf-name" type="search" autocomplete="off" placeholder="e.g. Carol"></div><div><label for="tf-cat">Trip type</label><select id="tf-cat"><option value="">All advisors</option>${cats.filter((c) => c.agents?.length).map((c) => `<option value="${e(c.id)}">${e(c.title)}</option>`).join('')}</select></div><button type="button" class="sx-btn ghost-dark" data-tf-clear>Clear</button><p class="sx-status" role="status" aria-live="polite"></p></div>`
      : '';
    return wrap(s, `${head(s, first)}${filter}<ul class="sx-cards sx-agents">${(s.items || [])
      .map((a) => {
        const slug = (a.link?.href || '').split('/').pop();
        const trips = catsByAgent.get(slug) || [];
        const loc = typeof a.location === 'object' ? tx(a.location) : a.location;
        const specs = (a.specialties || []).map((x) => tx(x.title) || x.title).filter(Boolean);
        return `<li class="sx-card sx-agent" data-agent="${e(slug)}" data-cats="${e(trips.map((c) => c.id).join(' '))}" data-name="${e(tx(a.name).toLowerCase())}">${img({ src: `/media/agents/${slug}-160.webp`, alt: tx(a.name) }, ' width="96" height="120"')}<div><h3><a ${hrefAttr(a.link?.href)}>${e(tx(a.name))}</a></h3><p class="sx-meta">${e([tx(a.role), loc].filter(Boolean).join(' · '))}</p><p>${e(tx(a.bio))}</p>${specs.length ? `<ul class="sx-chips">${specs.map((x) => `<li>${e(x)}</li>`).join('')}</ul>` : ''}${trips.length ? `<p class="sx-meta"><strong>Trip types:</strong> ${trips.map((c) => `<a ${hrefAttr(catUrl(c))}>${e(c.title)}</a>`).join(', ')}</p>` : ''}<p><a ${hrefAttr(a.link?.href)}>View full profile</a> · <a ${hrefAttr(`/contact?agent=${slug}`)}>Plan with ${e(tx(a.name).split(/[\s,]+/)[0])}</a></p></div></li>`;
      })
      .join('')}</ul>`, s.id === 'team-owners' ? 'alt' : '');
  },
  'teams.spotlight'(s, first, ctx) {
    const a = (s.items || [])[0] || {};
    const slug = ctx.route.split('/').pop();
    const trips = catsByAgent.get(slug) || [];
    const specs = (a.specialties || []).map((x) => tx(x.title) || x.title).filter(Boolean);
    const creds = (a.credentials || []).map((c) => c.label || tx(c)).filter(Boolean);
    const loc = typeof a.location === 'object' ? tx(a.location) : a.location;
    const portrait = a.avatarMedia?.src ? `<img class="sx-portrait" src="${e(imgSrc(a.avatarMedia.src))}" alt="${e(a.avatarMedia.alt || tx(a.name))}" fetchpriority="high" decoding="async">` : '';
    return wrap(s, `<div class="sx-split"><div>${portrait}</div><div><span class="sx-kicker">${e(tx(s.eyebrow))}</span><h1>${e(tx(a.name) || tx(s.title))}</h1><p class="sx-meta">${e([tx(a.role), loc].filter(Boolean).join(' · '))}</p>${tx(a.quote) ? `<blockquote><p>“${e(tx(a.quote))}”</p></blockquote>` : ''}<p class="sx-lead">${e(tx(a.bio))}</p>${tx(a.specializing) ? `<p>${e(tx(a.specializing))}</p>` : ''}${specs.length ? `<ul class="sx-chips">${specs.map((x) => `<li>${e(x)}</li>`).join('')}</ul>` : ''}${trips.length ? `<p><strong>Trip types:</strong> ${trips.map((c) => `<a ${hrefAttr(catUrl(c))}>${e(c.title)}</a>`).join(', ')}</p>` : ''}<div class="sx-actions"><a class="sx-btn" ${hrefAttr(`/contact?agent=${slug}`)}>Plan with ${e(tx(a.name).split(/[\s,]+/)[0])}</a>${tx(a.phone) ? `<a class="sx-btn ghost-dark" href="tel:${e(tx(a.phone).replace(/[^\d+]/g, ''))}">Call ${e(tx(a.phone))}</a>` : ''}</div>${creds.length ? `<h2>Credentials</h2>${list(creds)}` : ''}</div></div>`);
  },
  'gallery.masonry'(s, first) {
    return wrap(s, `${head(s, first)}<ul class="sx-gallery">${(s.items || []).map((g) => `<li><figure>${img(g.media)}<figcaption>${e(tx(g.title))}</figcaption></figure></li>`).join('')}</ul>`, 'alt');
  },
  split(s, first) {
    const side = (x) => (x?.media ? img(x.media) : `${head(x || {}, false)}<div class="sx-actions">${button(x?.primaryButton)}${button(x?.secondaryButton, 'ghost-dark')}</div>`);
    return wrap(s, `<div class="sx-split">${'<div>' + side(s.left) + '</div><div>' + side(s.right) + '</div>'}</div>`);
  },
  fallback(s, first) {
    return wrap(s, `${head(s, first)}${(s.items || []).length ? `<ul class="sx-cards sx-plain">${s.items.map((it) => `<li class="sx-card"><div><h3>${e(tx(it.title) || tx(it.name))}</h3><p>${e(tx(it.description))}</p></div></li>`).join('')}</ul>` : ''}`);
  },
};
const rendererFor = (id) =>
  id.startsWith('banner.') ? R.hero : id.startsWith('50.50.') ? R.split : R[id] || R.fallback;

// ---------------------------------------------------------------------------------------------
// Link/style processing for raw HTML (custom pages, blog bodies, rendered sections).
const styles = [];
const styleIndex = new Map();
function hoistStyles(html) {
  const ids = [];
  const out = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
    const key = crypto.createHash('md5').update(css).digest('hex');
    if (!styleIndex.has(key)) {
      styleIndex.set(key, styles.length);
      styles.push(css.trim());
    }
    ids.push(styleIndex.get(key));
    return '';
  });
  return { html: out, ids: [...new Set(ids)] };
}
function rewrite(html) {
  return html
    .replace(/(<a\b[^>]*?)\shref="([^"]*)"([^>]*)>/gi, (m, pre, href, post) => {
      const attr = hrefAttr(href.replace(/&amp;/g, '&'));
      const rest = `${pre}${post}`.replace(/\s(target|rel)="[^"]*"/g, '');
      return `${rest} ${attr}>`;
    })
    .replace(/\ssrc="([^"]+)"/g, (m, src) => ` src="${e(imgSrc(src.replace(/&amp;/g, '&')))}"`)
    .replace(/\ssrcset="([^"]+)"/g, (m, set) => (AGENT_IMG.test(set) ? '' : ` srcset="${set.split(',').map((p) => p.trim().replace(/^(\/[^\s]+)/, (u) => SITE_ORIGIN + u)).join(', ')}"`))
    .replace(/\saction="\/[^"]*"/g, '');
}

// ---------------------------------------------------------------------------------------------
// Pages
const homeWin = loadPageData('data/home.js');
const ir = homeWin.__ENRICHED_IR__;
let ctaHtml = '';
const pages = [];
for (const f of listDataFiles()) {
  const win = loadPageData(f);
  const route = win.__ROUTE_PATH__;
  const page = Object.values(win.__ENRICHED_IR__.pages)[0];
  let h = '';
  let first = true;
  for (const s of page.sections || []) {
    if (s.id === 'site-planning-cta') {
      if (!ctaHtml) ctaHtml = s.content;
      continue;
    }
    h += s.layoutId === 'customPage' ? s.content : rendererFor(s.layoutId)(s, first, { route });
    first = false;
  }
  // Exactly one level-1 heading per page for screen readers, without changing the page's styling.
  if (!/<h1[\s>]/i.test(h)) h = h.replace(/<h2\b/i, '<h2 role="heading" aria-level="1"');
  else {
    let n = 0;
    h = h.replace(/<h1\b/gi, (m) => (++n > 1 ? '<h1 role="heading" aria-level="2"' : m));
  }
  const { html, ids } = hoistStyles(rewrite(h));
  const entry = index.entries.find((x) => x.u === route);
  pages.push({ r: route, t: page.seo?.title || entry?.t || 'Superior Travel Consultants', h: html, s: ids });
}
pages.sort((a, b) => a.r.localeCompare(b.r));
const cta = hoistStyles(rewrite(ctaHtml));

const search = index.entries.map((x) => {
  const tags = (x.c || []).map((id) => index.categories[id]?.t).filter(Boolean).join(', ');
  return { u: x.u, t: x.t, k: tags ? `${x.k} · ${tags}` : x.k, d: x.d, b: (x.b || '').slice(0, 700) };
});

const names = Object.fromEntries(readJson('assets/st-agents.json').agents.map((a) => [a.slug, a.name.split(',')[0]]));
const payload = { pages, styles, cta: { h: cta.html, s: cta.ids }, search, img: agentImages, names };
const packed = zlib.gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 }).toString('base64');

// ---------------------------------------------------------------------------------------------
// Shell: header navigation and footer from the site's header/footer data.
const logo = `data:image/png;base64,${fs.readFileSync(path.join(ROOT, 'logos/1476896544.5688176.png')).toString('base64')}`;
const navItems = ir.header.center.navbarItems.navbarItems;
const navHtml = navItems
  .map((item, i) => {
    if (!item.mega) return `<li><a ${hrefAttr(item.link?.href)} data-nav>${e(item.text)}</a></li>`;
    const cols = item.mega.columns
      .map((c) => `<div><p class="menu-title">${e(c.title || '')}</p><ul>${(c.items || []).map((it) => `<li><a ${hrefAttr(it.link?.href)} data-nav>${e(it.text)}</a></li>`).join('')}</ul></div>`)
      .join('');
    return `<li class="has-menu"><button type="button" class="menu-toggle" aria-expanded="false" aria-controls="menu-${i}">${e(item.text)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg></button><div class="menu-panel" id="menu-${i}" hidden>${item.link?.href ? `<p class="menu-overview"><a ${hrefAttr(item.link.href)} data-nav>${e(item.text)} overview</a></p>` : ''}<div class="menu-cols">${cols}</div></div></li>`;
  })
  .join('');
const ft = ir.footer;
const footerCols = (ft.columns || []).map((c) => `<div><h2>${e(tx(c.title))}</h2><ul>${(c.links || []).map((l) => `<li><a ${hrefAttr(l.link?.href)}>${e(l.text)}</a></li>`).join('')}</ul></div>`).join('');
const co = ft.company;

// Web fonts used by the site (Latin subset, variable weights), embedded so the file stays standalone.
// Downloaded once from Google Fonts and cached in _tools/cache/fonts.css.
const FONT_CACHE = path.join(ROOT, '_tools', 'cache', 'fonts.css');
async function embeddedFonts() {
  if (fs.existsSync(FONT_CACHE)) return fs.readFileSync(FONT_CACHE, 'utf8');
  const families = 'family=EB+Garamond:ital,wght@0,400..800;1,400..800&family=Work+Sans:ital,wght@0,400..800;1,400..600&family=Raleway:ital,wght@0,400..800;1,400..600';
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${families}&display=swap`, {
    headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
  })).text();
  const latin = [...css.matchAll(/\/\* latin \*\/\s*(@font-face\s*\{[^}]+\})/g)].map((m) => m[1]);
  if (!latin.length) throw new Error('Could not read Google Fonts CSS');
  const out = [];
  for (const block of latin) {
    const url = block.match(/url\((https:[^)]+\.woff2)\)/)[1];
    const font = Buffer.from(await (await fetch(url)).arrayBuffer()).toString('base64');
    out.push(block.replace(/src:[^;]+;/, `src:url(data:font/woff2;base64,${font}) format("woff2");`).replace(/\s+/g, ' '));
  }
  write(FONT_CACHE, out.join('\n'));
  return out.join('\n');
}
const FONTS = await embeddedFonts();

const CSS = `
:root{--ink:#17323E;--muted:#5D7079;--navy:#163E52;--gold:#C87812;--gold-ink:#8a530c;--cream:#FFFCF7;--mist:#EDF6F8;--line:#dce6e8;--serif:"EB Garamond",Garamond,Georgia,"Times New Roman",serif;--sans:"Work Sans",system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
*{box-sizing:border-box}html{scroll-padding-top:84px}body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.6 var(--sans)}
img{max-width:100%;height:auto}a{color:inherit}[hidden]{display:none!important}
:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
.vh{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;margin:-1px;padding:0;border:0}
.skip{position:fixed;left:12px;top:-60px;z-index:100;background:var(--navy);color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600}.skip:focus{top:12px}
/* Header */
header.site{position:sticky;top:0;z-index:40;background:#fffcf7f5;border-bottom:1px solid var(--line);backdrop-filter:blur(8px)}
header.site .bar{display:flex;align-items:center;gap:12px;width:min(1120px,100%);margin:0 auto;padding:8px 24px;min-height:68px}
.brand{display:flex;align-items:center;flex:none}.brand img{width:56px;height:auto}
nav.main{margin:0 auto}nav.main>ul{list-style:none;margin:0;padding:0;display:flex;align-items:center;gap:2px}
nav.main a,.menu-toggle{display:flex;align-items:center;gap:4px;padding:10px 12px;border-radius:10px;text-decoration:none;font:500 15px/1.2 var(--sans);color:var(--ink);background:none;border:0;cursor:pointer}
nav.main a:hover,.menu-toggle:hover{background:#c878120f}nav.main a[aria-current="page"]{color:var(--gold-ink);text-decoration:underline;text-underline-offset:6px}
.menu-toggle svg{width:16px;height:16px}.menu-toggle[aria-expanded="true"] svg{transform:rotate(180deg)}
.has-menu{position:relative}
.menu-panel{position:absolute;top:calc(100% + 8px);left:50%;transform:translateX(-50%);background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 40px #0a1e2826;padding:16px 18px;min-width:280px;width:max-content;max-width:min(760px,92vw)}
.menu-cols{display:flex;gap:28px}.menu-cols ul{list-style:none;margin:0;padding:0}.menu-cols a{padding:7px 8px!important;font-size:14.5px!important}
.menu-title{margin:0 0 4px 8px;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-ink)}
.menu-overview{margin:0 0 8px;border-bottom:1px solid var(--line);padding-bottom:8px}
.actions{display:flex;gap:8px;margin-left:auto}
.icon-btn{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:999px;border:1px solid #e3d9c8;background:#fff;color:var(--ink);cursor:pointer}
.icon-btn:hover{border-color:var(--gold);background:#FBE8C9}.icon-btn svg{width:20px;height:20px}
.menu-btn{display:none}
@media(max-width:1060px){.menu-btn{display:inline-grid}nav.main{position:absolute;left:0;right:0;top:100%;background:var(--cream);border-bottom:1px solid var(--line);max-height:calc(100vh - 70px);overflow:auto;display:none}nav.main.open{display:block}nav.main>ul{flex-direction:column;align-items:stretch;padding:8px 16px 18px}.menu-panel{position:static;transform:none;box-shadow:none;border:0;padding:0 0 8px 12px;width:auto;max-width:none}.menu-cols{flex-direction:column;gap:6px}}
/* Rendered sections */
.sx{padding:52px 0}.sx.alt{background:var(--mist)}.sx.tight{padding:28px 0}
.sx-wrap{width:min(1120px,100%);margin:0 auto;padding:0 24px}.sx-wrap.narrow{width:min(860px,100%)}
.sx h1,.sx h2,.sx h3{font-family:var(--serif);font-weight:500;line-height:1.12;margin:0 0 10px;letter-spacing:-.01em}
.sx h1{font-size:clamp(36px,5vw,58px)}.sx h2{font-size:clamp(28px,3.4vw,40px);margin-top:8px}.sx h3{font-size:22px}
.sx-kicker{display:block;color:var(--gold-ink);font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;margin-bottom:8px}
.sx-lead{font-size:17px;max-width:760px;margin:0 0 14px}.sx-sub{color:var(--muted);margin:0 0 8px}.sx-meta{font-size:13px;color:var(--muted);margin:0 0 6px}.sx-note{font-size:13.5px;color:var(--muted)}
.sx-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.sx-btn{display:inline-flex;align-items:center;justify-content:center;text-align:center;min-height:44px;padding:10px 18px;border-radius:10px;background:var(--navy);color:#fff!important;text-decoration:none;font:600 14.5px/1.2 var(--sans);border:1px solid var(--navy);cursor:pointer}
.sx-btn:hover{background:#0f2f3f}.sx-btn.light{background:#fff;color:var(--navy)!important;border-color:#fff}.sx-btn.ghost{background:transparent;border-color:#ffffffa0}.sx-btn.ghost-dark{background:transparent;color:var(--navy)!important}
.sx-hero{color:#fff;background:linear-gradient(90deg,#0b2633e6,#0b263399 60%,#0b263340),var(--bg,linear-gradient(135deg,#163E52,#346C8D)) center/cover;padding:84px 0 70px}
.sx-hero .sx-kicker{color:#F8C979}.sx-hero .sx-sub,.sx-hero .sx-lead{color:#eef5f7}
.sx-cards{list-style:none;margin:20px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.sx-card{background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.sx-card>div,.sx-card>blockquote{padding:16px 18px}.sx-card>img{width:100%;aspect-ratio:16/10;object-fit:cover;background:var(--mist)}
.sx-card h3 a{text-decoration:none}.sx-card h3 a:hover{text-decoration:underline}.sx-card p{margin:0 0 8px;font-size:14.5px}
.sx-plain .sx-card{display:block}
.sx-agents{grid-template-columns:repeat(auto-fill,minmax(330px,1fr))}
.sx-agent{flex-direction:row;gap:14px;padding:16px}.sx-agent>img{width:96px;height:120px;aspect-ratio:auto;border-radius:10px;flex:none;object-fit:cover}.sx-agent>div{padding:0}
.sx-agent a{color:var(--gold-ink)}.sx-agent h3 a{color:var(--ink)}
.sx-chips{list-style:none;margin:6px 0 8px;padding:0;display:flex;flex-wrap:wrap;gap:6px}.sx-chips li{font-size:11px;font-weight:600;color:#7a4c12;background:#FBE8C9;border-radius:999px;padding:3px 9px}
.sx-badges{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:10px 26px;font-weight:600}.sx-badges li::before{content:"✓ ";color:var(--gold)}
.sx-split{display:grid;grid-template-columns:1fr 1fr;gap:32px;align-items:start}@media(max-width:820px){.sx-split{grid-template-columns:1fr}}
.sx-split img{border-radius:14px;width:100%}.sx-portrait{max-width:420px}
.sx-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin:16px 0}.sx-facts div{background:#fff;border:1px solid var(--line);border-radius:10px;padding:10px 12px}.sx-facts dt{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-ink)}.sx-facts dd{margin:0;font-weight:600}
.sx-list{margin:8px 0 18px;padding-left:20px}.sx-list li{margin-bottom:6px}
.sx-timeline{list-style:none;margin:18px 0 0;padding:0;border-left:3px solid #FBE8C9}.sx-timeline li{padding:0 0 18px 18px}
.sx-faq details{background:#fff;border:1px solid var(--line);border-radius:10px;margin-bottom:8px}.sx-faq summary{cursor:pointer;padding:14px 16px;font-weight:600}.sx-faq details p{padding:0 16px 14px;margin:0}
.sx-gallery{list-style:none;margin:18px 0 0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}.sx-gallery img{border-radius:12px;width:100%}.sx-gallery figure{margin:0}.sx-gallery figcaption{font-size:13px;color:var(--muted)}
.sx-flyer{max-width:520px;border-radius:12px}
.sx-article .sx-feature{width:100%;border-radius:14px;margin:12px 0 22px}
.sx-prose{font-size:17px;line-height:1.7}.sx-prose img{border-radius:12px}.sx-prose table{width:100%;border-collapse:collapse;display:block;overflow-x:auto}
blockquote{margin:0}blockquote footer{font-size:13px;color:var(--muted);margin-top:8px}
.sx-form{display:grid;grid-template-columns:1fr 1fr;gap:12px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px}
.sx-field{display:flex;flex-direction:column;gap:4px}.sx-field.full,.sx-form .sx-note,.sx-form .sx-status{grid-column:1/-1}
.sx-field label,.sx-filter label{display:block;font-size:13px;font-weight:600;margin-bottom:4px}
.sx-filter input,.sx-filter select,.sx-filter button{width:100%;height:44px;min-height:0}
.sx-filter button{width:auto}
input[type="search"]{-webkit-appearance:none;appearance:none;box-sizing:border-box}
.sx-field input,.sx-field textarea,.sx-filter input,.sx-filter select{font:inherit;color:var(--ink);padding:10px 12px;border:1px solid #b9c7cb;border-radius:10px;background:#fff;min-height:44px}
.sx-field [aria-invalid="true"]{border-color:#b3261e}.sx-error{color:#b3261e;font-size:12.5px;margin:0}
.sx-form button{justify-self:start}@media(max-width:640px){.sx-form{grid-template-columns:1fr}}
.sx-filter{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end;background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;margin:18px 0 6px}.sx-filter .sx-status{grid-column:1/-1;margin:0;font-size:14px;color:var(--muted)}
@media(max-width:700px){.sx-filter{grid-template-columns:1fr}}
.sx-404{padding:90px 0;text-align:center}
.loading{padding:120px 24px;text-align:center;color:var(--muted)}
/* Compact custom-page layouts */
@media(min-width:900px){.stc .hero,.stc .hero .wrap,.srp .hero,.srp .hero .wrap,.sth .hero,.stc #collection-hero,.stc #collection-hero .wrap{min-height:clamp(420px,62vh,560px)!important}.stc .wrap,.stl .wrap,.srp .wrap,.sth .wrap{padding-top:64px!important;padding-bottom:64px!important}}
.sth .logos-viewport:focus-within .logos,.sth .logos-viewport.st-paused .logos{animation-play-state:paused!important}
.st-rail-toggle{margin-top:14px;padding:6px 12px;border:1px solid #c9d3d6;border-radius:999px;background:#fff;color:#17323e;font:600 12px var(--sans);cursor:pointer}
/* Footer */
footer.site{background:#163E52;color:#dce7eb;padding:44px 0 26px;font-size:14px}
footer.site .cols{width:min(1120px,100%);margin:0 auto;padding:0 24px;display:grid;grid-template-columns:1.3fr repeat(4,1fr);gap:26px}
footer.site h2{font:700 11px/1.4 var(--sans);letter-spacing:.16em;text-transform:uppercase;color:#F8C979;margin:0 0 10px}
footer.site ul{list-style:none;margin:0;padding:0}footer.site li{margin-bottom:7px}footer.site a{color:#fff;text-decoration:none}footer.site a:hover{text-decoration:underline}
footer.site .legal{width:min(1120px,100%);margin:26px auto 0;padding:16px 24px 0;border-top:1px solid #ffffff2a;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;color:#b8cdd5}
@media(max-width:860px){footer.site .cols{grid-template-columns:1fr 1fr}}
/* Search */
dialog.search{width:min(740px,calc(100vw - 24px));max-height:min(86vh,820px);padding:0;border:0;border-radius:16px;background:var(--cream);color:var(--ink);box-shadow:0 24px 70px #0a1e2859}
dialog.search::backdrop{background:#091c268c}
.search-head{display:flex;justify-content:space-between;align-items:center;padding:16px 18px 0}.search-head h2{font:500 24px var(--serif);margin:0}
.search-form{display:flex;gap:8px;padding:12px 18px 6px}.search-form input{flex:1;min-height:46px;padding:10px 12px;border:1px solid #b9c7cb;border-radius:10px;font:16px var(--sans);color:var(--ink)}
.search-status{padding:4px 18px 8px;font-size:13px;color:var(--muted);margin:0}
.results{list-style:none;margin:0;padding:0 10px 16px;max-height:62vh;overflow:auto}
.results a{display:block;padding:12px 10px;border-radius:10px;text-decoration:none;border-bottom:1px solid #e8eeef}.results a:hover,.results a:focus-visible{background:var(--mist)}
.results .k{display:block;font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gold-ink)}.results .t{display:block;font:500 20px/1.2 var(--serif)}.results .d{display:block;font-size:13.5px;color:#4a5f68}
mark{background:#FBE8C9;color:inherit}
.to-top{position:fixed;right:18px;bottom:18px;z-index:30;width:48px;height:48px;border-radius:999px;border:2px solid #fff;background:var(--navy);color:#fff;box-shadow:0 6px 18px #0a1e284d;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s}
.to-top.show{opacity:1;pointer-events:auto}.to-top:hover{background:var(--gold);color:#111}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}.st-rail-toggle{display:none}}
`.replace(/\n/g, '');

const JS = `
(function () {
  'use strict';
  var doc = document, $ = function (id) { return doc.getElementById(id); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var main = $('main'), pageStyle = $('page-style'), DATA = null, BY = {}, firstRender = true;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); }

  function load() {
    var b64 = $('payload').textContent.trim();
    var bytes = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); });
    if (!('DecompressionStream' in window)) return Promise.reject(new Error('unsupported'));
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).json();
  }

  function parse() {
    var raw = decodeURIComponent(location.hash.slice(1)) || '/';
    if (raw.charAt(0) !== '/') return null;
    var anchor = '', q = '';
    var hi = raw.indexOf('#'); if (hi > -1) { anchor = raw.slice(hi + 1); raw = raw.slice(0, hi); }
    var qi = raw.indexOf('?'); if (qi > -1) { q = raw.slice(qi + 1); raw = raw.slice(0, qi); }
    var p = raw.replace(/\\/+$/, '') || '/';
    return { path: p, query: new URLSearchParams(q), anchor: anchor };
  }

  function render() {
    if (!DATA) return;
    var r = parse(); if (!r) return;
    var page = BY[r.path];
    closeMenus();
    if (!page) {
      pageStyle.textContent = '';
      main.innerHTML = '<section class="sx sx-404"><div class="sx-wrap"><h1>Page not found</h1><p class="sx-lead" style="margin:0 auto 18px">We could not find <code>' + esc(r.path) + '</code>. Try searching, or go back to the home page.</p><div class="sx-actions" style="justify-content:center"><a class="sx-btn" href="#/">Home</a><button type="button" class="sx-btn ghost-dark" data-open-search>Search the site</button></div></div></section>';
      doc.title = 'Page not found | Superior Travel Consultants';
    } else {
      var ids = page.s.concat(r.path === '/contact' || r.path === '/contact-us' ? [] : DATA.cta.s);
      pageStyle.textContent = ids.map(function (i) { return DATA.styles[i]; }).join('\\n');
      var html = page.h + (r.path === '/contact' || r.path === '/contact-us' ? '' : DATA.cta.h);
      main.innerHTML = html.replace(/st-agent-img:([a-z-]+)/g, function (m, s) { return DATA.img[s] || ''; });
      doc.title = page.t;
      hooks(r);
    }
    doc.querySelectorAll('[data-nav]').forEach(function (a) {
      var h = (a.getAttribute('href') || '').slice(1).split('?')[0];
      if (h === r.path) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    var target = r.anchor && main.querySelector('[id="' + r.anchor.replace(/"/g, '') + '"]');
    if (target) target.scrollIntoView();
    else if (!firstRender) window.scrollTo(0, 0);
    if (!firstRender) {
      var h1 = main.querySelector('h1:not([aria-level]), [aria-level="1"]') || main;
      h1.setAttribute('tabindex', '-1');
      h1.focus({ preventScroll: true });
    }
    firstRender = false;
  }

  // Page-specific behavior
  function hooks(r) {
    var filter = main.querySelector('[data-team-filter]');
    if (filter) teamFilter(filter, r);
    var form = main.querySelector('[data-mailto-form]');
    if (form) contactForm(form, r);
  }
  function teamFilter(box, r) {
    var name = box.querySelector('#tf-name'), cat = box.querySelector('#tf-cat'), status = box.querySelector('.sx-status');
    var cards = Array.prototype.slice.call(main.querySelectorAll('.sx-agent'));
    function apply() {
      var q = norm(name.value.trim()), c = cat.value, n = 0;
      cards.forEach(function (el) {
        var ok = (!q || norm(el.getAttribute('data-name')).indexOf(q) > -1) && (!c || (' ' + el.getAttribute('data-cats') + ' ').indexOf(' ' + c + ' ') > -1);
        el.hidden = !ok; if (ok) n++;
      });
      main.querySelectorAll('.sx-agents').forEach(function (ul) { ul.closest('section').hidden = !ul.querySelector('.sx-agent:not([hidden])'); });
      box.closest('section').hidden = false;
      status.textContent = (q || c) ? (n ? 'Showing ' + n + ' of ' + cards.length + ' advisors' + (c ? ' for ' + cat.options[cat.selectedIndex].text : '') + '.' : 'No advisors match. Try another name or trip type.') : '';
    }
    name.addEventListener('input', apply);
    cat.addEventListener('change', apply);
    box.querySelector('[data-tf-clear]').addEventListener('click', function () { name.value = ''; cat.value = ''; apply(); name.focus(); });
    var pre = r.query.get('specialty');
    if (pre) { cat.value = pre; apply(); }
  }
  function contactForm(form, r) {
    var subject = form.querySelector('[name=subject]');
    var agent = r.query.get('agent'), dest = r.query.get('destination') || r.query.get('region'), pkg = r.query.get('package'), partner = r.query.get('partner');
    function title(s) { return s.replace(/-/g, ' ').replace(/\\b\\w/g, function (c) { return c.toUpperCase(); }); }
    if (agent) subject.value = 'Trip planning with ' + (DATA.names[agent] || title(agent));
    else if (dest) subject.value = 'Trip to ' + title(dest);
    else if (pkg) subject.value = 'Question about ' + title(pkg);
    else if (partner) subject.value = 'Question about ' + title(partner);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = null;
      Array.prototype.forEach.call(form.querySelectorAll('input,textarea'), function (f) {
        var out = form.querySelector('[data-error-for="' + f.name + '"]'), msg = '';
        if (!f.validity.valid) msg = f.validity.typeMismatch ? 'Please enter a valid email address.' : 'Please fill in this field.';
        if (out) out.textContent = msg;
        if (msg) { f.setAttribute('aria-invalid', 'true'); bad = bad || f; } else f.removeAttribute('aria-invalid');
      });
      if (bad) { bad.focus(); return; }
      var v = function (n) { return form.querySelector('[name=' + n + ']').value.trim(); };
      var body = v('message') + '\\n\\nName: ' + v('name') + '\\nEmail: ' + v('email') + (v('phone') ? '\\nPhone: ' + v('phone') : '') + (v('dates') ? '\\nTravel dates: ' + v('dates') : '');
      location.href = 'mailto:inquiries@superiortravel.com?subject=' + encodeURIComponent(v('subject')) + '&body=' + encodeURIComponent(body);
      form.querySelector('.sx-status').textContent = 'Your email app should open with your message ready to send. If it does not, email inquiries@superiortravel.com or call (516) 224-7880.';
    });
  }

  // Header menus
  var menuBtn = $('menu-btn'), nav = $('main-nav');
  function closeMenus(except) {
    doc.querySelectorAll('.menu-toggle').forEach(function (b) { if (b !== except) { b.setAttribute('aria-expanded', 'false'); $(b.getAttribute('aria-controls')).hidden = true; } });
    if (!except) { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); }
  }
  doc.addEventListener('click', function (e) {
    var t = e.target.closest('.menu-toggle');
    if (t) {
      var open = t.getAttribute('aria-expanded') !== 'true';
      closeMenus(t);
      t.setAttribute('aria-expanded', String(open));
      $(t.getAttribute('aria-controls')).hidden = !open;
      return;
    }
    if (!e.target.closest('.menu-panel')) doc.querySelectorAll('.menu-toggle[aria-expanded="true"]').forEach(function (b) { b.setAttribute('aria-expanded', 'false'); $(b.getAttribute('aria-controls')).hidden = true; });
    // In-page anchors (not routes)
    var a = e.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href').charAt(1) !== '/') {
      var id = a.getAttribute('href').slice(1), el = id && (id === 'main' ? main : main.querySelector('[id="' + id.replace(/"/g, '') + '"]'));
      e.preventDefault();
      if (el) { el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: true }); }
      return;
    }
    var rail = e.target.closest('[data-st-rail-toggle]');
    if (rail && rail.previousElementSibling) {
      var paused = rail.previousElementSibling.classList.toggle('st-paused');
      rail.setAttribute('aria-pressed', String(paused));
      rail.textContent = paused ? 'Play logo animation' : 'Pause logo animation';
    }
    if (e.target.closest('[data-open-search]')) openSearch();
  });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') { var open = doc.querySelector('.menu-toggle[aria-expanded="true"]'); closeMenus(); if (open) open.focus(); } });
  menuBtn.addEventListener('click', function () { var o = nav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', String(o)); });

  // Back to top
  var top = $('to-top');
  window.addEventListener('scroll', function () { top.classList.toggle('show', window.scrollY > 600); }, { passive: true });
  top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); doc.querySelector('.brand').focus({ preventScroll: true }); });

  // Search
  var dlg = $('search-dialog'), input = $('search-input'), results = $('results'), sStatus = $('search-status'), opener = null;
  function tokens(q) { return norm(q).split(/[^a-z0-9&]+/).filter(function (t) { return t.length > 1 && !/^(the|and|of|to|in|for|an|vs)$/.test(t); }).map(function (t) { return t.length > 4 ? t.replace(/([^s])s$/, '$1') : t; }); }
  function mark(text, toks) { var out = esc(text); toks.forEach(function (t) { out = out.replace(new RegExp('(^|[^a-z0-9])(' + t + '[a-z]*)', 'gi'), '$1<mark>$2</mark>'); }); return out; }
  function runSearch() {
    if (!DATA) return;
    var q = input.value.trim(), toks = tokens(q);
    if (!toks.length) { results.innerHTML = ''; sStatus.textContent = 'Search ' + DATA.search.length + ' pages: blogs, Travel Journal, destinations, trip types, advisors and offers.'; return; }
    var hits = [];
    DATA.search.forEach(function (x) {
      var s = 0;
      for (var i = 0; i < toks.length; i++) { var t = toks[i]; if (x._t.indexOf(t) > -1) s += 10; else if (x._k.indexOf(t) > -1) s += 6; else if (x._d.indexOf(t) > -1) s += 4; else if (x._b.indexOf(t) > -1) s += 1; else return; }
      hits.push({ x: x, s: s });
    });
    hits.sort(function (a, b) { return b.s - a.s; });
    sStatus.textContent = hits.length ? hits.length + (hits.length === 1 ? ' result' : ' results') + ' for “' + q + '”.' : 'No results for “' + q + '”. Try a destination, trip type or advisor name, or call (516) 224-7880.';
    results.innerHTML = hits.slice(0, 40).map(function (h) { return '<li><a href="#' + esc(h.x.u) + '"><span class="k">' + esc(h.x.k) + '</span><span class="t">' + mark(h.x.t, toks) + '</span><span class="d">' + mark(h.x.d || h.x.b.slice(0, 160), toks) + '</span></a></li>'; }).join('');
  }
  function openSearch() { opener = doc.activeElement; dlg.showModal(); input.focus(); input.select(); runSearch(); }
  $('open-search').addEventListener('click', openSearch);
  $('close-search').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); if (e.target.closest('#results a')) { opener = null; dlg.close(); } });
  dlg.addEventListener('close', function () { if (opener && opener.focus) opener.focus(); });
  input.addEventListener('input', runSearch);
  $('search-form').addEventListener('submit', function (e) { e.preventDefault(); var a = results.querySelector('a'); if (a) a.click(); });
  doc.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); openSearch(); }
  });

  window.addEventListener('hashchange', render);
  load().then(function (data) {
    DATA = data;
    data.pages.forEach(function (p) { BY[p.r] = p; });
    window.stRoutes = Object.keys(BY);
    data.search.forEach(function (x) { x._t = norm(x.t); x._k = norm(x.k); x._d = norm(x.d); x._b = norm(x.b); });
    render();
  }).catch(function () {
    main.innerHTML = '<div class="loading">This browser cannot open the offline site. Please use a current version of Chrome, Edge, Firefox or Safari, or visit <a href="${SITE_ORIGIN}">superiortravel.com</a>.</div>';
  });
})();
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Superior Travel Consultants | Customized Travel Planning</title>
<meta name="description" content="Superior Travel Consultants of Baldwin, New York: customized travel planning backed by more than 150 years of combined experience.">
<style>${FONTS}${CSS}</style>
<style id="page-style"></style>
</head>
<body>
<a class="skip" href="#main">Skip to main content</a>
<header class="site"><div class="bar">
<a class="brand" href="#/" aria-label="Superior Travel Consultants — Home"><img src="${logo}" width="227" height="202" alt=""></a>
<nav class="main" id="main-nav" aria-label="Main"><ul>${navHtml}</ul></nav>
<div class="actions">
<button type="button" class="icon-btn" id="open-search" aria-haspopup="dialog" aria-controls="search-dialog" aria-label="Search the site"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>
<button type="button" class="icon-btn menu-btn" id="menu-btn" aria-expanded="false" aria-controls="main-nav" aria-label="Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
</div></div></header>
<main id="main" tabindex="-1"><div class="loading" role="status">Loading Superior Travel…</div></main>
<noscript><p class="loading">This offline copy of the site needs JavaScript. Visit <a href="${SITE_ORIGIN}">superiortravel.com</a>.</p></noscript>
<footer class="site"><div class="cols">
<div><img src="${logo}" width="72" height="64" alt="Superior Travel Consultants" style="background:#fff;border-radius:10px;padding:4px"><p>${e(tx(co.description))}</p><ul><li>${e(co.address)}</li><li><a href="tel:+15162247880">${e(co.phone)}</a></li><li><a href="mailto:${e(co.email)}">${e(co.email)}</a></li><li><a href="${e(co.social.facebook)}" target="_blank" rel="noopener noreferrer">Facebook<span class="vh"> (opens in a new tab)</span></a> · <a href="${e(co.social.instagram)}" target="_blank" rel="noopener noreferrer">Instagram<span class="vh"> (opens in a new tab)</span></a></li></ul></div>
${footerCols}
</div><div class="legal"><p>${e(tx(ft.bottom?.copyright))}</p><p><a href="#/privacy">Privacy</a> · <a href="#/terms">Terms</a> · <a href="${SITE_ORIGIN}" target="_blank" rel="noopener noreferrer">superiortravel.com</a></p></div></footer>
<button type="button" class="to-top" id="to-top" aria-label="Back to top"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m5 12 7-7 7 7M12 19V5"/></svg></button>
<dialog class="search" id="search-dialog" aria-labelledby="search-title">
<div class="search-head"><h2 id="search-title">Search Superior Travel</h2><button type="button" class="icon-btn" id="close-search" aria-label="Close search">✕</button></div>
<form class="search-form" role="search" id="search-form"><label class="vh" for="search-input">Search the site</label><input id="search-input" type="search" autocomplete="off" placeholder="Try “Disney”, “river cruise” or an advisor’s name"></form>
<p class="search-status" id="search-status" role="status" aria-live="polite"></p><ul class="results" id="results"></ul>
</dialog>
<script type="application/octet-stream" id="payload">${packed}</script>
<script>${JS}</script>
</body>
</html>
`;

write('standalone/superior-travel.html', html);
const raw = Buffer.byteLength(JSON.stringify(payload));
console.log(`standalone/superior-travel.html — ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB (${pages.length} pages; content ${(raw / 1024).toFixed(0)} KB compressed into the file, ${styles.length} shared style blocks).`);
