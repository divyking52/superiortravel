// Builds standalone/superior-travel.html: a single self-contained page (inline CSS and JS, embedded
// logo and advisor photos) generated from the site content. Run after `node _tools/build.mjs`.
// Usage: node _tools/make-standalone.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SITE_ORIGIN, readJson, write, loadPageData, escapeHtml as e } from './lib.mjs';

const index = readJson('assets/search-index.json');
const directory = readJson('assets/st-agents.json');
const catCfg = readJson('content/categories.json');
const partners = readJson('content/partners.json');
const generated = new Set(readJson('_tools/.generated.json').routes);

const dataUri = (file, type) => `data:${type};base64,${fs.readFileSync(path.join(ROOT, file)).toString('base64')}`;
const logo = dataUri('logos/1476896544.5688176.png', 'image/png');
// New trip-type pages are not on the live site yet, so they link within this file instead.
const live = (url) => (generated.has(url) ? null : `${SITE_ORIGIN}${url === '/' ? '' : url}`);
const entryByUrl = new Map(index.entries.map((x) => [x.u, x]));
const agents = new Map(directory.agents.map((a) => [a.slug, a]));
const teamBios = new Map();
for (const s of Object.values(loadPageData('data/team.js').__ENRICHED_IR__.pages)[0].sections) {
  for (const it of s.items || []) teamBios.set((it.link?.href || '').split('/').pop(), it.bio?.text || '');
}

const cats = catCfg.navigation.columns.flatMap((c) => c.items).map((id) => catCfg.categories.find((c) => c.id === id)).filter((c) => c && c.status === 'published');
const catUrl = (c) => (c.page === 'new' ? `/${c.slug}` : c.page);
const catsByAgent = new Map();
for (const c of cats) for (const s of c.agents || []) catsByAgent.set(s, [...(catsByAgent.get(s) || []), c]);

const agentOrder = ['carol-mcparland', 'james-mcparland', 'robin-holian', 'lois-howes', 'lynne-kaplan', 'fran-lozano', 'izabela-melli', 'renata-boulos', 'mary-susan-schilling', 'heather-hamann', 'blake-rehfield'];
const firstSentences = (text) => {
  const s = (text || '').match(/[^.!?]+[.!?]["”']?(?=\s|$)/g) || [];
  let out = '';
  for (const x of s) {
    if (out.length >= 60 || (out && `${out} ${x.trim()}`.length > 200)) break;
    out = out ? `${out} ${x.trim()}` : x.trim();
  }
  return out.length > 40 ? out : '';
};

const tripCards = cats
  .map((c) => {
    const names = (c.agents || []).map((s) => agents.get(s)?.name.split(',')[0]).filter(Boolean);
    const href = live(catUrl(c));
    const desc = c.navDescription || entryByUrl.get(catUrl(c))?.d || '';
    return `<li class="trip"><h3>${e(c.title)}</h3>${desc ? `<p>${e(desc)}</p>` : ''}${names.length ? `<p class="trip-agents">Advisors: ${e(names.join(', '))}</p>` : ''}<div class="trip-links">${href ? `<a href="${e(href)}" target="_blank" rel="noopener noreferrer">Explore<span class="vh"> ${e(c.title)} (opens in a new tab)</span></a>` : ''}${names.length ? `<button type="button" class="linkish" data-filter="${e(c.id)}">See advisors<span class="vh"> for ${e(c.title)}</span></button>` : ''}</div></li>`;
  })
  .join('');

const advisorCards = agentOrder
  .filter((s) => agents.has(s))
  .map((slug) => {
    const a = agents.get(slug);
    const bio = firstSentences(teamBios.get(slug));
    const photo = fs.existsSync(path.join(ROOT, `media/agents/${slug}-160.webp`)) ? dataUri(`media/agents/${slug}-160.webp`, 'image/webp') : '';
    const trips = catsByAgent.get(slug) || [];
    return `<li class="agent" data-agent="${e(slug)}" data-cats="${e(trips.map((c) => c.id).join(' '))}" data-name="${e(a.name.toLowerCase())}">${photo ? `<img src="${photo}" width="96" height="120" alt="${e(a.name)}">` : ''}<div><h3>${e(a.name)}</h3><p class="role">${e(a.role)}</p>${bio ? `<p class="bio">${e(bio)}</p>` : ''}${a.specialties.length ? `<ul class="chips" aria-label="Listed specialties">${a.specialties.map((s) => `<li>${e(s)}</li>`).join('')}</ul>` : ''}${trips.length ? `<p class="trips"><strong>Trip types:</strong> ${e(trips.map((c) => c.title).join(', '))}</p>` : ''}<p class="links"><a href="${SITE_ORIGIN}${e(a.profile)}" target="_blank" rel="noopener noreferrer">Full profile<span class="vh"> for ${e(a.name)} (opens in a new tab)</span></a><a href="${SITE_ORIGIN}/contact?agent=${e(slug)}" target="_blank" rel="noopener noreferrer">Plan with ${e(a.name.split(/[\s,]+/)[0])}<span class="vh"> (opens in a new tab)</span></a></p></div></li>`;
  })
  .join('');

const fmt = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const articles = index.entries
  .filter((x) => x.k === 'Blog' || x.k === 'Travel Journal')
  .sort((a, b) => String(b.p || '').localeCompare(String(a.p || '')) || a.t.localeCompare(b.t));
const articleCards = articles
  .slice(0, 9)
  .map((x) => `<li class="article"><a href="${SITE_ORIGIN}${e(x.u)}" target="_blank" rel="noopener noreferrer"><span class="kicker">${e(x.k)}${x.p ? ` · ${e(fmt(x.p))}` : ''}</span><span class="title">${e(x.t)}</span><span class="excerpt">${e(x.d)}</span><span class="vh">(opens in a new tab)</span></a></li>`)
  .join('');

const partnerNames = [...new Set([...partners.featured, ...partners.directory].map((p) => p.name))].sort((a, b) => a.localeCompare(b));

// Compact search data: live pages only, short body excerpt for matching.
const searchData = index.entries
  .filter((x) => live(x.u))
  .map((x) => {
    const tags = (x.c || []).map((id) => index.categories[id]?.t).filter(Boolean).join(', ');
    return { u: `${SITE_ORIGIN}${x.u === '/' ? '' : x.u}`, t: x.t, k: tags ? `${x.k} · ${tags}` : x.k, d: x.d, b: (x.b || '').slice(0, 600) };
  });
for (const c of cats.filter((c) => !live(catUrl(c)))) searchData.push({ u: `#advisors?${c.id}`, t: c.title, k: 'Trip Type', d: c.intro || '', b: (c.keywords || []).join(' ') });

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Superior Travel Consultants | Customized Travel Planning</title>
<meta name="description" content="Plan a customized vacation with Superior Travel Consultants of Baldwin, New York, backed by more than 150 years of combined travel-industry experience.">
<style>
:root{--ink:#17323E;--muted:#5D7079;--navy:#163E52;--gold:#C87812;--gold-ink:#8a530c;--cream:#FFFCF7;--mist:#EDF6F8;--sand:#F7EFE3;--line:#dce6e8;--serif:"EB Garamond",Garamond,Georgia,serif;--sans:"Work Sans",system-ui,-apple-system,"Segoe UI",Arial,sans-serif}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--cream);color:var(--ink);font:16px/1.6 var(--sans)}
img{max-width:100%}
a{color:inherit}
h1,h2,h3{font-family:var(--serif);font-weight:500;line-height:1.1;margin:0;letter-spacing:-.01em}
p{margin:0}
.vh{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;margin:-1px;padding:0;border:0}
:focus-visible{outline:3px solid var(--gold);outline-offset:3px}
.skip{position:fixed;left:12px;top:-60px;z-index:100;background:var(--navy);color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600}
.skip:focus{top:12px}
.wrap{width:min(1120px,100%);margin:0 auto;padding:0 24px}
section{padding:56px 0}
section.alt{background:var(--mist)}
.kicker{display:block;color:var(--gold-ink);font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:8px}
.section-head{display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap;margin-bottom:24px}
.section-head h2{font-size:clamp(30px,3.6vw,42px)}
.section-head p{color:var(--muted);max-width:560px}
.btn{display:inline-flex;align-items:center;gap:8px;min-height:46px;padding:11px 20px;border-radius:10px;background:var(--navy);color:#fff;text-decoration:none;font-weight:600;border:1px solid var(--navy);cursor:pointer;font:600 15px/1 var(--sans)}
.btn:hover{background:#0f2f3f}
.btn.light{background:#fff;color:var(--navy);border-color:#fff}
.btn.ghost{background:transparent;color:#fff;border-color:#ffffff80}
.linkish{background:none;border:0;padding:0;font:inherit;color:var(--gold-ink);font-weight:600;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
/* Header */
header.site{position:sticky;top:0;z-index:20;background:#fffcf7f2;border-bottom:1px solid var(--line);backdrop-filter:blur(8px)}
header.site .wrap{display:flex;align-items:center;gap:16px;min-height:68px}
.brand{display:flex;align-items:center;gap:10px;text-decoration:none;font-family:var(--serif);font-size:19px;font-weight:600}
.brand img{width:52px;height:auto}
nav.main{margin-left:auto}
nav.main ul{list-style:none;margin:0;padding:0;display:flex;gap:4px}
nav.main a{display:block;padding:9px 12px;border-radius:10px;text-decoration:none;font-weight:500}
nav.main a:hover{background:#c878120f}
.icon-btn{display:inline-grid;place-items:center;width:44px;height:44px;border-radius:999px;border:1px solid #e3d9c8;background:#fff;color:var(--ink);cursor:pointer}
.icon-btn:hover{border-color:var(--gold);background:#FBE8C9}
.icon-btn svg{width:20px;height:20px}
.menu-btn{display:none}
@media(max-width:860px){.menu-btn{display:inline-grid}nav.main{position:absolute;left:0;right:0;top:100%;background:var(--cream);border-bottom:1px solid var(--line);display:none}nav.main.open{display:block}nav.main ul{flex-direction:column;padding:8px 16px 16px}nav.main a{padding:12px}.header-actions{margin-left:auto}}
.header-actions{display:flex;gap:8px}
/* Hero */
.hero{background:linear-gradient(135deg,#163E52,#346C8D 55%,#65A8BF);color:#fff;padding:72px 0 64px}
.hero h1{font-size:clamp(42px,6vw,72px);max-width:760px}
.hero h1 em{font-style:italic}
.hero p.lead{max-width:600px;margin:18px 0 26px;font-size:18px;color:#eef5f7}
.hero .actions{display:flex;gap:12px;flex-wrap:wrap}
.promise{display:flex;flex-wrap:wrap;gap:10px 28px;margin-top:34px;padding-top:20px;border-top:1px solid #ffffff38;font-size:14px;color:#dce9ee}
.promise span::before{content:"✓";color:#F8C979;margin-right:8px}
/* Trip types */
.grid{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.trips-grid{grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}
.trip{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:8px}
.trip h3{font-size:24px}
.trip p{font-size:14px;color:var(--muted)}
.trip .trip-agents{color:var(--ink)}
.trip-links{margin-top:auto;display:flex;gap:16px;flex-wrap:wrap;font-size:14px}
.trip-links a{color:var(--gold-ink);font-weight:600}
/* Advisors */
.filters{display:grid;grid-template-columns:1fr 1fr auto;gap:12px;align-items:end;background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:18px}
.filters label{display:block;font-size:13px;font-weight:600;margin-bottom:4px}
.filters input,.filters select{width:100%;min-height:44px;padding:9px 11px;border:1px solid #b9c7cb;border-radius:10px;font:inherit;color:var(--ink);background:#fff}
.filters button{min-height:44px;padding:0 16px;border:1px solid #b9c7cb;border-radius:10px;background:#fff;font:600 14px var(--sans);color:var(--ink);cursor:pointer}
@media(max-width:700px){.filters{grid-template-columns:1fr}}
.status{font-size:14px;color:var(--muted);margin:0 0 14px;min-height:1.4em}
.agents{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
.agent{display:grid;grid-template-columns:96px minmax(0,1fr);gap:16px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px}
.agent img{width:96px;height:120px;object-fit:cover;border-radius:10px;background:var(--mist)}
.agent h3{font-size:22px}
.agent .role{font-size:13px;color:var(--muted);margin-bottom:8px}
.agent .bio{font-size:14px;margin-bottom:8px}
.agent .trips{font-size:13px;margin:6px 0 8px}
.chips{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.chips li{font-size:11px;font-weight:600;color:#7a4c12;background:#FBE8C9;border-radius:999px;padding:3px 9px}
.agent .links{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:14px;font-weight:600}
.agent .links a{color:var(--gold-ink)}
.agent.highlight{box-shadow:0 0 0 3px var(--gold)}
@media(max-width:420px){.agents{grid-template-columns:1fr}.agent{grid-template-columns:72px minmax(0,1fr)}.agent img{width:72px;height:90px}}
/* Articles */
.articles{grid-template-columns:repeat(auto-fill,minmax(280px,1fr))}
.article a{display:flex;flex-direction:column;gap:6px;height:100%;padding:18px;background:#fff;border:1px solid var(--line);border-radius:14px;text-decoration:none}
.article a:hover{border-color:var(--gold)}
.article .title{font-family:var(--serif);font-size:22px;line-height:1.15}
.article .excerpt{font-size:14px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
/* Partners */
.partners{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.partners li{padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:#fff;font-size:14px;font-weight:600}
/* CTA + contact */
.cta{background:var(--navy);color:#fff}
.cta .wrap{display:grid;grid-template-columns:1.4fr 1fr;gap:32px;align-items:center}
.cta h2{font-size:clamp(32px,4vw,46px);margin-bottom:12px}
.cta p{color:#d8e5ea}
.cta .note{font-size:13px;color:#b8cdd5;margin-top:12px}
.contact-list{list-style:none;margin:0;padding:0;display:grid;gap:10px}
.contact-list a{color:#fff}
@media(max-width:760px){.cta .wrap{grid-template-columns:1fr}}
footer.site{background:#0f2f3f;color:#cfdde3;font-size:14px;padding:28px 0}
footer.site .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
footer.site a{color:#fff}
/* Search dialog */
dialog.search{width:min(720px,calc(100vw - 24px));max-height:min(86vh,800px);padding:0;border:0;border-radius:16px;background:var(--cream);color:var(--ink);box-shadow:0 24px 70px #0a1e2859}
dialog.search::backdrop{background:#091c268c}
.search-head{display:flex;justify-content:space-between;align-items:center;padding:16px 18px 0}
.search-head h2{font-size:24px}
.search-form{display:flex;gap:8px;padding:12px 18px 6px;flex-wrap:wrap}
.search-form input{flex:1 1 260px;min-height:46px;padding:10px 12px;border:1px solid #b9c7cb;border-radius:10px;font:16px var(--sans);color:var(--ink)}
.search-status{padding:4px 18px 8px;font-size:13px;color:var(--muted)}
.results{list-style:none;margin:0;padding:0 10px 16px;max-height:60vh;overflow:auto}
.results a{display:block;padding:12px 10px;border-radius:10px;text-decoration:none;border-bottom:1px solid #e8eeef}
.results a:hover,.results a:focus-visible{background:var(--mist)}
.results .t{display:block;font-family:var(--serif);font-size:20px}
.results .d{display:block;font-size:13.5px;color:#4a5f68}
mark{background:#FBE8C9;color:inherit}
/* Back to top */
.to-top{position:fixed;right:18px;bottom:18px;z-index:30;width:48px;height:48px;border-radius:999px;border:2px solid #fff;background:var(--navy);color:#fff;box-shadow:0 6px 18px #0a1e284d;cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s}
.to-top.show{opacity:1;pointer-events:auto}
.to-top:hover{background:var(--gold);color:#111}
[hidden]{display:none!important}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important;animation:none!important}}
</style>
</head>
<body>
<a class="skip" href="#main">Skip to main content</a>
<header class="site">
  <div class="wrap">
    <a class="brand" href="#top" aria-label="Superior Travel Consultants — top of page"><img src="${logo}" width="227" height="202" alt=""><span>Superior Travel</span></a>
    <nav class="main" id="main-nav" aria-label="Main">
      <ul>
        <li><a href="#trips">Trip types</a></li>
        <li><a href="#advisors">Our team</a></li>
        <li><a href="#journal">Travel Journal</a></li>
        <li><a href="#partners">Partners</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
    <div class="header-actions">
      <button type="button" class="icon-btn" id="open-search" aria-haspopup="dialog" aria-controls="search-dialog" aria-label="Search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>
      <button type="button" class="icon-btn menu-btn" id="menu-btn" aria-expanded="false" aria-controls="main-nav" aria-label="Menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
    </div>
  </div>
</header>

<main id="main" tabindex="-1">
<section class="hero" id="top" aria-labelledby="hero-title">
  <div class="wrap">
    <span class="kicker" style="color:#F8C979">Superior Travel Consultants · Baldwin, New York</span>
    <h1 id="hero-title">Travel designed around <em>you.</em></h1>
    <p class="lead">Hotels, resorts, cruises and tours, expertly tailored by advisors with over 150 years of combined experience.</p>
    <div class="actions">
      <a class="btn light" href="${SITE_ORIGIN}/contact" target="_blank" rel="noopener noreferrer">Start planning<span class="vh"> (opens in a new tab)</span></a>
      <a class="btn ghost" href="#advisors">Meet our advisors</a>
    </div>
    <div class="promise"><span>Personally planned</span><span>Availability subject to supplier confirmation</span><span>Support before, during and after travel.</span></div>
  </div>
</section>

<section id="trips" aria-labelledby="trips-title">
  <div class="wrap">
    <div class="section-head"><div><span class="kicker">Find your kind of trip</span><h2 id="trips-title">Trip types</h2></div><p>Choose a travel style to explore, or see which advisors plan it.</p></div>
    <ul class="grid trips-grid">${tripCards}</ul>
  </div>
</section>

<section class="alt" id="advisors" aria-labelledby="advisors-title">
  <div class="wrap">
    <div class="section-head"><div><span class="kicker">The team</span><h2 id="advisors-title">Meet our advisors</h2></div><p>Search by name or filter by trip type, then view a full profile or start planning directly.</p></div>
    <div class="filters" role="search" aria-label="Find an advisor">
      <div><label for="agent-name">Search by name</label><input id="agent-name" type="search" autocomplete="off" placeholder="e.g. Carol"></div>
      <div><label for="agent-cat">Trip type</label><select id="agent-cat"><option value="">All advisors</option>${cats.filter((c) => c.agents?.length).map((c) => `<option value="${e(c.id)}">${e(c.title)}</option>`).join('')}</select></div>
      <button type="button" id="agent-clear">Clear</button>
    </div>
    <p class="status" id="agent-status" role="status" aria-live="polite"></p>
    <ul class="grid agents" id="agent-list">${advisorCards}</ul>
    <p class="status" id="agent-empty" hidden>No advisors match. Try another name or trip type.</p>
  </div>
</section>

<section id="journal" aria-labelledby="journal-title">
  <div class="wrap">
    <div class="section-head"><div><span class="kicker">Advice from our advisors</span><h2 id="journal-title">From the Travel Journal and blog</h2></div><p><a href="${SITE_ORIGIN}/travel-journal" target="_blank" rel="noopener noreferrer">All Travel Journal articles</a> · <a href="${SITE_ORIGIN}/blogs" target="_blank" rel="noopener noreferrer">All blog posts</a></p></div>
    <ul class="grid articles">${articleCards}</ul>
  </div>
</section>

<section class="alt" id="partners" aria-labelledby="partners-title">
  <div class="wrap">
    <div class="section-head"><div><span class="kicker">Great journeys, trusted names</span><h2 id="partners-title">Our travel partners</h2></div><p><a href="${SITE_ORIGIN}/partners" target="_blank" rel="noopener noreferrer">View the partner directory</a></p></div>
    <ul class="partners">${partnerNames.map((n) => `<li>${e(n)}</li>`).join('')}</ul>
  </div>
</section>

<section class="cta" id="contact" aria-labelledby="contact-title">
  <div class="wrap">
    <div>
      <span class="kicker" style="color:#F8C979">More than 150 years of combined experience</span>
      <h2 id="contact-title">Ready to plan something exceptional?</h2>
      <p>Share the destination, dates and travel style you have in mind. A Superior Travel advisor will help turn the possibilities into one clear, personal plan.</p>
      <p style="margin-top:20px"><a class="btn light" href="${SITE_ORIGIN}/contact" target="_blank" rel="noopener noreferrer">Open the trip-planning form<span class="vh"> (opens in a new tab)</span></a></p>
      <p class="note">Availability, rates and booking confirmations are verified with suppliers before booking.</p>
    </div>
    <ul class="contact-list">
      <li><strong>Phone:</strong> <a href="tel:+15162247880">(516) 224-7880</a></li>
      <li><strong>Email:</strong> <a href="mailto:inquiries@superiortravel.com">inquiries@superiortravel.com</a></li>
      <li><strong>Office:</strong> Baldwin, New York</li>
      <li><a href="https://www.facebook.com/superiortravelconsultants/" target="_blank" rel="noopener noreferrer">Facebook<span class="vh"> (opens in a new tab)</span></a> · <a href="https://www.instagram.com/superiortravel.agent/" target="_blank" rel="noopener noreferrer">Instagram<span class="vh"> (opens in a new tab)</span></a></li>
    </ul>
  </div>
</section>
</main>

<footer class="site">
  <div class="wrap"><p>© ${new Date().getFullYear()} Superior Travel Consultants LLC. All rights reserved.</p><p><a href="${SITE_ORIGIN}/privacy" target="_blank" rel="noopener noreferrer">Privacy</a> · <a href="${SITE_ORIGIN}/terms" target="_blank" rel="noopener noreferrer">Terms</a> · <a href="${SITE_ORIGIN}" target="_blank" rel="noopener noreferrer">superiortravel.com</a></p></div>
</footer>

<button type="button" class="to-top" id="to-top" aria-label="Back to top"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m5 12 7-7 7 7M12 19V5"/></svg></button>

<dialog class="search" id="search-dialog" aria-labelledby="search-title">
  <div class="search-head"><h2 id="search-title">Search Superior Travel</h2><button type="button" class="icon-btn" id="close-search" aria-label="Close search">✕</button></div>
  <form class="search-form" role="search" id="search-form"><label class="vh" for="search-input">Search articles, destinations, trip types and advisors</label><input id="search-input" type="search" autocomplete="off" placeholder="Try “Disney”, “river cruise” or an advisor’s name"></form>
  <p class="search-status" id="search-status" role="status" aria-live="polite">Type to search ${searchData.length} pages on superiortravel.com.</p>
  <ul class="results" id="results"></ul>
</dialog>

<script>
(function () {
  var DATA = ${JSON.stringify(searchData).replace(/</g, '\\u003c')};
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); }

  // Mobile menu
  var menuBtn = $('menu-btn'), nav = $('main-nav');
  menuBtn.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.addEventListener('click', function (e) { if (e.target.closest('a')) { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); } });

  // Back to top
  var top = $('to-top');
  window.addEventListener('scroll', function () { top.classList.toggle('show', window.scrollY > 600); }, { passive: true });
  top.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' }); document.querySelector('.brand').focus({ preventScroll: true }); });

  // Advisor filter
  var nameIn = $('agent-name'), catSel = $('agent-cat'), status = $('agent-status'), empty = $('agent-empty');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.agent'));
  function filter() {
    var q = norm(nameIn.value.trim()), cat = catSel.value, n = 0;
    cards.forEach(function (c) {
      var ok = (!q || norm(c.getAttribute('data-name')).indexOf(q) > -1) && (!cat || (' ' + c.getAttribute('data-cats') + ' ').indexOf(' ' + cat + ' ') > -1);
      c.hidden = !ok; if (ok) n++;
    });
    var label = cat ? catSel.options[catSel.selectedIndex].text : '';
    status.textContent = (q || cat) && n ? 'Showing ' + n + ' of ' + cards.length + ' advisors' + (label ? ' for ' + label : '') + '.' : '';
    empty.hidden = n > 0;
  }
  nameIn.addEventListener('input', filter);
  catSel.addEventListener('change', filter);
  $('agent-clear').addEventListener('click', function () { nameIn.value = ''; catSel.value = ''; filter(); nameIn.focus(); });
  function showCategory(id) {
    catSel.value = id; nameIn.value = ''; filter();
    $('advisors').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    catSel.focus({ preventScroll: true });
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-filter]');
    if (b) showCategory(b.getAttribute('data-filter'));
  });

  // Search
  var dlg = $('search-dialog'), input = $('search-input'), results = $('results'), sStatus = $('search-status'), opener = null;
  DATA.forEach(function (x) { x._t = norm(x.t); x._d = norm(x.d); x._b = norm(x.b); x._k = norm(x.k); });
  function tokens(q) { return norm(q).split(/[^a-z0-9&]+/).filter(function (t) { return t.length > 1 && !/^(the|and|of|to|in|for|a|an|vs)$/.test(t); }).map(function (t) { return t.length > 4 ? t.replace(/([^s])s$/, '$1') : t; }); }
  function mark(text, toks) {
    var out = esc(text);
    toks.forEach(function (t) { out = out.replace(new RegExp('(^|[^a-z0-9])(' + t + '[a-z]*)', 'gi'), '$1<mark>$2</mark>'); });
    return out;
  }
  function run() {
    var q = input.value.trim(), toks = tokens(q);
    if (!toks.length) { results.innerHTML = ''; sStatus.textContent = 'Type to search ' + DATA.length + ' pages on superiortravel.com.'; return; }
    var hits = [];
    DATA.forEach(function (x) {
      var s = 0;
      for (var i = 0; i < toks.length; i++) {
        var t = toks[i];
        if (x._t.indexOf(t) > -1) s += 10; else if (x._k.indexOf(t) > -1) s += 6; else if (x._d.indexOf(t) > -1) s += 4; else if (x._b.indexOf(t) > -1) s += 1; else return;
      }
      hits.push({ x: x, s: s });
    });
    hits.sort(function (a, b) { return b.s - a.s; });
    sStatus.textContent = hits.length ? hits.length + (hits.length === 1 ? ' result' : ' results') + ' for “' + q + '”.' : 'No results for “' + q + '”. Try a destination, trip type or advisor name, or call (516) 224-7880.';
    results.innerHTML = hits.slice(0, 30).map(function (h) {
      var x = h.x, internal = x.u.charAt(0) === '#';
      return '<li><a href="' + esc(x.u) + '"' + (internal ? '' : ' target="_blank" rel="noopener noreferrer"') + '><span class="kicker">' + esc(x.k) + '</span><span class="t">' + mark(x.t, toks) + '</span><span class="d">' + mark(x.d || x.b.slice(0, 160), toks) + '</span>' + (internal ? '' : '<span class="vh">(opens in a new tab)</span>') + '</a></li>';
    }).join('');
  }
  function openSearch() { opener = document.activeElement; dlg.showModal(); input.focus(); input.select(); run(); }
  $('open-search').addEventListener('click', openSearch);
  $('close-search').addEventListener('click', function () { dlg.close(); });
  dlg.addEventListener('close', function () { if (opener) opener.focus(); });
  dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
  input.addEventListener('input', run);
  $('search-form').addEventListener('submit', function (e) { e.preventDefault(); var a = results.querySelector('a'); if (a) a.click(); });
  results.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#advisors?"]');
    if (!a) return;
    e.preventDefault(); dlg.close(); showCategory(a.getAttribute('href').split('?')[1]);
  });
  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); openSearch(); }
  });
})();
</script>
</body>
</html>
`;

write('standalone/superior-travel.html', html);
console.log(`standalone/superior-travel.html — ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB, ${searchData.length} searchable pages, ${articles.length} articles (9 shown).`);
