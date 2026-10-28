// HTML templates for generated Storebox `customPage` content. Each block is self-contained
// (scoped <style> + markup), matching how existing custom pages are authored in Storebox, so the
// output can also be pasted into the CMS page editor.
import { escapeHtml as e } from './lib.mjs';

const BRAND = {
  ink: '#17323E',
  muted: '#5D7079',
  navy: '#163E52',
  gold: '#a66b1f',
  goldBg: '#C87812',
  cream: '#FFFCF7',
  mist: '#EDF6F8',
  line: '#dce6e8',
};

export const marker = (name) => [`<!--st:${name}-->`, `<!--/st:${name}-->`];
export const wrapMarker = (name, html) => {
  const [a, b] = marker(name);
  return `${a}${html}${b}`;
};

const SHARED_CSS = `
.stx{--ink:${BRAND.ink};--muted:${BRAND.muted};--navy:${BRAND.navy};--gold:${BRAND.gold};--line:${BRAND.line};color:var(--ink);font:15px/1.65 "Work Sans",system-ui,sans-serif}
.stx *{box-sizing:border-box}
.stx h1,.stx h2,.stx h3{font-family:"EB Garamond",Georgia,serif;font-weight:500;line-height:1.1;letter-spacing:-.015em;margin:0}
.stx p{margin:0}
.stx a{color:inherit}
.stx a:focus-visible,.stx button:focus-visible,.stx summary:focus-visible,.stx input:focus-visible,.stx select:focus-visible,.stx textarea:focus-visible{outline:3px solid ${BRAND.goldBg};outline-offset:3px}
.stx .stx-wrap{width:min(1120px,100%);margin:0 auto;padding:0 24px}
.stx .stx-kicker{display:block;color:var(--gold);font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;margin-bottom:10px}
.stx .stx-section{padding:48px 0}
.stx .stx-section h2{font-size:clamp(28px,3.2vw,38px);margin-bottom:8px}
.stx .stx-section .stx-sub{color:var(--muted);max-width:640px;margin-bottom:22px}
.stx .stx-btn{display:inline-flex;align-items:center;gap:10px;min-height:46px;padding:11px 20px;border-radius:10px;background:var(--navy);color:#fff;text-decoration:none;font-weight:600;font-size:14px;border:1px solid var(--navy)}
.stx .stx-btn:hover{background:#0f2f3f}
.stx .stx-btn--ghost{background:transparent;color:var(--navy)}
.stx .stx-btn--ghost:hover{background:#163e520d}
.stx .stx-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}
.stx .stx-crumbs{display:flex;flex-wrap:wrap;gap:6px;font-size:12px;color:var(--muted);margin-bottom:18px}
.stx .stx-crumbs a{text-decoration:none}
.stx .stx-crumbs a:hover{text-decoration:underline}
.stx .stx-hero{background:linear-gradient(135deg,#EDF6F8,#FFFCF7 70%);border-bottom:1px solid var(--line);padding:40px 0 36px}
.stx .stx-hero h1{font-size:clamp(38px,5vw,56px);margin-bottom:12px}
.stx .stx-hero .stx-lead{max-width:680px;font-size:16px;color:#2c4a57}
.stx .stx-agents{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.stx .stx-agent{display:grid;grid-template-columns:96px minmax(0,1fr);gap:16px;align-items:start;background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px}
.stx .stx-agent img{width:96px;height:120px;object-fit:cover;border-radius:10px;background:${BRAND.mist}}
.stx .stx-agent h3{font-size:22px;margin-bottom:2px}
.stx .stx-agent h3 a{text-decoration:none}
.stx .stx-agent h3 a:hover{text-decoration:underline}
.stx .stx-agent .stx-role{font-size:12px;color:var(--muted);margin-bottom:8px}
.stx .stx-agent .stx-bio{font-size:13.5px;line-height:1.55;margin-bottom:8px}
.stx .stx-chips{list-style:none;margin:0 0 10px;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.stx .stx-chips li{font-size:11px;font-weight:600;color:#7a4c12;background:#FBE8C9;border-radius:999px;padding:3px 9px}
.stx .stx-agent .stx-links{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;font-weight:600}
.stx .stx-agent .stx-links a{color:${BRAND.gold};text-decoration:none}
.stx .stx-agent .stx-links a:hover{text-decoration:underline}
.stx .stx-cards{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.stx .stx-card a{display:flex;flex-direction:column;gap:6px;height:100%;padding:16px 18px;background:#fff;border:1px solid var(--line);border-radius:12px;text-decoration:none}
.stx .stx-card a:hover{border-color:${BRAND.goldBg}}
.stx .stx-card .stx-type{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}
.stx .stx-card .stx-title{font-family:"EB Garamond",Georgia,serif;font-size:21px;line-height:1.15}
.stx .stx-card .stx-excerpt{font-size:13px;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.stx .stx-styles{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.stx .stx-styles a{display:inline-block;padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:#fff;text-decoration:none;font-size:13px;font-weight:600}
.stx .stx-styles a:hover{border-color:${BRAND.goldBg}}
.stx .stx-styles a[aria-current="page"]{background:var(--navy);border-color:var(--navy);color:#fff}
.stx .stx-alt{background:${BRAND.mist}}
@media(max-width:640px){.stx .stx-section{padding:36px 0}.stx .stx-wrap{padding:0 16px}.stx .stx-hero{padding:28px 0}.stx .stx-agent{grid-template-columns:76px minmax(0,1fr);gap:12px;padding:14px}.stx .stx-agent img{width:76px;height:95px}}
`;

const css = (extra = '') => `<style>${(SHARED_CSS + extra).replace(/\n/g, '')}</style>`;

function agentImage(agent, eager = false) {
  const srcset = agent.thumbs ? ` srcset="${agent.thumbs[160]} 160w, ${agent.thumbs[320]} 320w" sizes="96px"` : '';
  return `<img src="${e(agent.thumbs ? agent.thumbs[160] : agent.avatar)}"${srcset} width="96" height="120" alt="${e(agent.name)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
}

export function renderAgentCard(agent) {
  const first = agent.name.split(/[\s,]+/)[0];
  const chips = agent.specialtyLabels.length
    ? `<ul class="stx-chips" aria-label="Listed specialties">${agent.specialtyLabels.map((s) => `<li>${e(s)}</li>`).join('')}</ul>`
    : '';
  return `<li class="stx-agent">${agentImage(agent)}<div><h3><a href="${e(agent.profileUrl)}">${e(agent.name)}</a></h3><p class="stx-role">${e(agent.role)}${agent.location ? ` · ${e(agent.location)}` : ''}</p>${agent.shortBio ? `<p class="stx-bio">${e(agent.shortBio)}</p>` : ''}${chips}<p class="stx-links"><a href="${e(agent.profileUrl)}">View profile<span class="stx-vh"> for ${e(agent.name)}</span></a><a href="${e(agent.contactUrl)}">Plan with ${e(first)}</a></p></div></li>`;
}

function renderRelated(items, headingId) {
  if (!items.length) return '';
  return `<section class="stx-section stx-alt" aria-labelledby="${headingId}"><div class="stx-wrap"><h2 id="${headingId}">Related guides and pages</h2><p class="stx-sub">Existing articles and pages from Superior Travel Consultants.</p><ul class="stx-cards">${items
    .map((r) => `<li class="stx-card"><a href="${e(r.url)}"><span class="stx-type">${e(r.type)}</span><span class="stx-title">${e(r.title)}</span>${r.excerpt ? `<span class="stx-excerpt">${e(r.excerpt)}</span>` : ''}</a></li>`)
    .join('')}</ul></div></section>`;
}

function renderStyleLinks(categories, currentId, headingId) {
  return `<section class="stx-section" aria-labelledby="${headingId}"><div class="stx-wrap"><h2 id="${headingId}">More trip types</h2><ul class="stx-styles">${categories
    .map((c) => `<li><a href="${e(c.url)}"${c.id === currentId ? ' aria-current="page"' : ''}>${e(c.title)}</a></li>`)
    .join('')}</ul></div></section>`;
}

const VH_CSS = `.stx .stx-vh{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}`;

export function renderCategoryPage({ category, agents, related, hotels, allCategories }) {
  const id = category.id;
  const hotelsBlock = hotels.length
    ? `<section class="stx-section" aria-labelledby="${id}-hotels"><div class="stx-wrap"><h2 id="${id}-hotels">Featured hotels and resorts</h2><ul class="stx-cards">${hotels
        .map((h) => `<li class="stx-card"><a href="${e(h.url)}"><span class="stx-type">${e(h.locationLabel)}</span><span class="stx-title">${e(h.name)}</span></a></li>`)
        .join('')}</ul></div></section>`
    : '';
  return `${css(VH_CSS)}<div class="stx" data-st-generated="category:${e(id)}">
<section class="stx-hero"><div class="stx-wrap"><nav class="stx-crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><span>Trip types</span><span aria-hidden="true">/</span><span aria-current="page">${e(category.title)}</span></nav><span class="stx-kicker">Trip types</span><h1>${e(category.title)}</h1><p class="stx-lead">${e(category.intro)}</p><div class="stx-actions"><a class="stx-btn" href="/contact">Start planning <span aria-hidden="true">↗</span></a><a class="stx-btn stx-btn--ghost" href="#advisors">Meet the advisors</a></div></div></section>
<section class="stx-section" id="advisors" aria-labelledby="${id}-advisors"><div class="stx-wrap"><h2 id="${id}-advisors">Advisors for ${e(category.title)}</h2><p class="stx-sub">Choose an advisor to view their full profile or start planning with them directly.</p><ul class="stx-agents">${agents.map(renderAgentCard).join('')}</ul></div></section>
${hotelsBlock}${renderRelated(related, `${id}-related`)}${renderStyleLinks(allCategories, id, `${id}-styles`)}
</div>`;
}

/** Advisor section appended to an existing page that serves as a category's landing page. */
export function renderAdvisorsBlock({ category, agents }) {
  const id = category.id;
  return wrapMarker(
    `advisors:${id}`,
    `${css(VH_CSS)}<div class="stx" data-st-generated="advisors:${e(id)}"><section class="stx-section stx-alt" id="advisors" aria-labelledby="${id}-advisors"><div class="stx-wrap"><span class="stx-kicker">${e(category.title)}</span><h2 id="${id}-advisors">Advisors for ${e(category.title)}</h2><p class="stx-sub">Choose an advisor to view their full profile or start planning with them directly.</p><ul class="stx-agents">${agents
      .map(renderAgentCard)
      .join('')}</ul></div></section></div>`,
  );
}

/** Compact row of links to every trip type, added under the homepage "Find your kind of trip" cards. */
export function renderHomeStyleLinks(categories) {
  return wrapMarker(
    'more-styles',
    `<style>.st-more-styles{margin-top:22px;display:flex;flex-wrap:wrap;align-items:center;gap:10px 14px}.st-more-styles h3{font:600 11px/1.4 "Work Sans",system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#a66b1f;margin:0}.st-more-styles ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}.st-more-styles a{display:inline-block;padding:7px 13px;border:1px solid #d7dfe1;border-radius:999px;background:#fff;color:#17323e;text-decoration:none;font:600 13px/1.3 "Work Sans",system-ui,sans-serif}.st-more-styles a:hover{border-color:#C87812}.st-more-styles a:focus-visible{outline:3px solid #C87812;outline-offset:2px}</style><nav class="st-more-styles" aria-labelledby="st-more-styles-title"><h3 id="st-more-styles-title">More trip types</h3><ul>${categories
      .map((c) => `<li><a href="${e(c.url)}">${e(c.title)}</a></li>`)
      .join('')}</ul></nav>`,
  );
}

const HOTEL_CSS = `
.stx .stx-hotel-hero{padding:36px 0 32px;background:linear-gradient(135deg,#EDF6F8,#FFFCF7 70%);border-bottom:1px solid var(--line)}
.stx .stx-hotel-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:28px;align-items:center}
.stx .stx-hotel-hero h1{font-size:clamp(36px,4.6vw,54px);margin-bottom:10px}
.stx .stx-loc{font-weight:600;color:#2c4a57}
.stx figure{margin:0}
.stx .stx-hero-img img{display:block;width:100%;height:auto;aspect-ratio:4/3;object-fit:cover;border-radius:14px;background:${BRAND.mist}}
.stx figcaption{font-size:11.5px;color:var(--muted);margin-top:6px}
.stx .stx-prose p{max-width:720px;margin-bottom:12px}
.stx .stx-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:18px 0 0;padding:0}
.stx .stx-facts div{background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.stx .stx-facts dt{font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--gold)}
.stx .stx-facts dd{margin:2px 0 0;font-weight:600}
.stx .stx-gallery{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.stx .stx-gallery img{display:block;width:100%;height:auto;aspect-ratio:3/2;object-fit:cover;border-radius:10px;background:${BRAND.mist}}
.stx .stx-amenities{columns:2 260px;column-gap:28px;margin:0;padding-left:18px}
.stx .stx-amenities li{margin-bottom:6px;break-inside:avoid}
.stx .stx-offers{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px}
.stx .stx-offer{background:#fff;border:1px solid var(--line);border-left:4px solid ${BRAND.goldBg};border-radius:12px;padding:16px 18px}
.stx .stx-offer h3{font-size:22px;margin-bottom:6px}
.stx .stx-offer .stx-promo{font-weight:700;color:#7a4c12;margin-bottom:6px}
.stx .stx-offer .stx-expiry{font-size:12px;color:var(--muted);margin-top:8px}
.stx .stx-offer .stx-terms{font-size:12px;color:var(--muted);margin-top:4px}
.stx .stx-faq details{background:#fff;border:1px solid var(--line);border-radius:10px;margin-bottom:8px}
.stx .stx-faq summary{cursor:pointer;padding:14px 16px;font-weight:600;list-style-position:inside}
.stx .stx-faq details>div{padding:0 16px 14px;color:#2c4a57}
.stx .stx-contact{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr);gap:28px;align-items:start}
.stx .stx-contact-card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px}
.stx .stx-contact-card a{color:${BRAND.gold};font-weight:600}
.stx form.stx-form{background:#fff;border:1px solid var(--line);border-radius:14px;padding:20px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
.stx .stx-field{display:flex;flex-direction:column;gap:5px}
.stx .stx-field--full{grid-column:1/-1}
.stx .stx-field label{font-size:13px;font-weight:600}
.stx .stx-field input,.stx .stx-field textarea{font:inherit;padding:10px 12px;border:1px solid #b9c7cb;border-radius:8px;background:#fff;color:var(--ink)}
.stx .stx-field textarea{min-height:110px;resize:vertical}
.stx .stx-field [aria-invalid="true"]{border-color:#b3261e}
.stx .stx-error{color:#b3261e;font-size:12px;min-height:0}
.stx .stx-hp{position:absolute!important;left:-10000px!important;width:1px;height:1px;overflow:hidden}
.stx .stx-form-note{grid-column:1/-1;font-size:12px;color:var(--muted)}
.stx .stx-form button{justify-self:start;grid-column:1/-1;cursor:pointer;font:inherit}
.stx .stx-form button[disabled]{opacity:.6;cursor:progress}
.stx .stx-status{grid-column:1/-1;padding:12px 14px;border-radius:10px;font-weight:600}
.stx .stx-status--ok{background:#e7f4ec;color:#1d5b34}
.stx .stx-status--err{background:#fbeaea;color:#8c1d18}
.stx .stx-placeholder{border:2px dashed #c98b2b;background:#fff8ec;border-radius:12px;padding:16px 18px;color:#7a4c12;font-weight:600}
.stx .stx-draft-banner{position:sticky;top:0;z-index:5;background:#8c1d18;color:#fff;padding:10px 16px;font-weight:700;text-align:center}
@media(max-width:820px){.stx .stx-hotel-grid,.stx .stx-contact{grid-template-columns:1fr}.stx form.stx-form{grid-template-columns:1fr}}
`;

const placeholder = (draft, text) => (draft ? `<p class="stx-placeholder">Content required: ${e(text)}</p>` : '');

const paragraphs = (text) =>
  String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${e(p)}</p>`)
    .join('');

const fmtDate = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export function renderHotelPage({ hotel, specialist, contact, draft, missing, today }) {
  const slug = hotel.slug;
  const loc = [hotel.location?.area, hotel.location?.country].filter(Boolean).join(', ');
  const photos = (hotel.photos || []).filter((p) => p.src);
  const hero = photos[0];
  const offers = (hotel.offers || []).filter((o) => !o.validUntil || o.validUntil >= today);
  const faqs = (hotel.faqs || []).filter((f) => f.question && f.answer);
  const amenities = (hotel.amenities || []).filter(Boolean);
  const credit = (p) => (p.credit ? `<figcaption>${e(p.caption ? `${p.caption} · ` : '')}Photo: ${e(p.credit)}</figcaption>` : p.caption ? `<figcaption>${e(p.caption)}</figcaption>` : '');

  const banner = draft
    ? `<p class="stx-draft-banner" role="note">${e(draft)}${missing.length ? ` Missing: ${e(missing.join(', '))}.` : ''}</p>`
    : '';

  const heroMedia = hero
    ? `<figure class="stx-hero-img"><img src="${e(hero.src)}" alt="${e(hero.alt)}" width="${hero.width || 1200}" height="${hero.height || 900}" fetchpriority="high" decoding="async">${credit(hero)}</figure>`
    : placeholder(draft, 'approved hero photograph with credit/permission');

  const gallery = photos.length > 1
    ? `<section class="stx-section" aria-labelledby="${slug}-gallery"><div class="stx-wrap"><h2 id="${slug}-gallery">Photo gallery</h2><ul class="stx-gallery">${photos
        .slice(1)
        .map((p) => `<li><figure><img src="${e(p.src)}" alt="${e(p.alt)}" width="${p.width || 900}" height="${p.height || 600}" loading="lazy" decoding="async">${credit(p)}</figure></li>`)
        .join('')}</ul></div></section>`
    : draft
      ? `<section class="stx-section"><div class="stx-wrap"><h2>Photo gallery</h2>${placeholder(draft, 'approved gallery images (optional)')}</div></section>`
      : '';

  const amenitiesBlock = amenities.length
    ? `<section class="stx-section stx-alt" aria-labelledby="${slug}-features"><div class="stx-wrap"><h2 id="${slug}-features">Features and amenities</h2><ul class="stx-amenities">${amenities.map((a) => `<li>${e(a)}</li>`).join('')}</ul></div></section>`
    : draft
      ? `<section class="stx-section stx-alt"><div class="stx-wrap"><h2>Features and amenities</h2>${placeholder(draft, 'verified features and amenities')}</div></section>`
      : '';

  const offersBlock = offers.length
    ? `<section class="stx-section" aria-labelledby="${slug}-offers" data-st-offers><div class="stx-wrap"><h2 id="${slug}-offers">Current offers</h2><p class="stx-sub">Offers depend on travel dates, room category and availability, and are confirmed with the hotel before booking.</p><ul class="stx-offers">${offers
        .map(
          (o) => `<li class="stx-offer"${o.validUntil ? ` data-st-expires="${e(o.validUntil)}"` : ''}><h3>${e(o.title)}</h3>${o.promo ? `<p class="stx-promo">${e(o.promo)}</p>` : ''}${o.details ? `<p>${e(o.details)}</p>` : ''}${o.validUntil ? `<p class="stx-expiry">Book by <time datetime="${e(o.validUntil)}">${e(fmtDate(o.validUntil))}</time></p>` : ''}${o.terms ? `<p class="stx-terms">${e(o.terms)}</p>` : ''}</li>`,
        )
        .join('')}</ul><p class="stx-sub" data-st-offers-empty hidden>There are no current offers for this hotel. Ask an advisor about rates for your dates.</p></div></section>`
    : draft
      ? `<section class="stx-section"><div class="stx-wrap"><h2>Current offers</h2>${placeholder(draft, 'approved offers with validity/expiry dates (optional)')}</div></section>`
      : '';

  const faqBlock = faqs.length
    ? `<section class="stx-section stx-alt stx-faq" aria-labelledby="${slug}-faq"><div class="stx-wrap"><h2 id="${slug}-faq">Frequently asked questions</h2>${faqs
        .map((f) => `<details><summary>${e(f.question)}</summary><div>${paragraphs(f.answer)}</div></details>`)
        .join('')}</div></section>`
    : draft
      ? `<section class="stx-section stx-alt"><div class="stx-wrap"><h2>Frequently asked questions</h2>${placeholder(draft, 'approved FAQs (optional)')}</div></section>`
      : '';

  const contactCard = specialist
    ? `<div class="stx-contact-card"><span class="stx-kicker">Your hotel specialist</span><ul class="stx-agents">${renderAgentCard(specialist)}</ul></div>`
    : `<div class="stx-contact-card"><span class="stx-kicker">Talk to our team</span><h3>${e(contact.label)}</h3><p>Call <a href="tel:${e(contact.phone.replace(/[^\d+]/g, ''))}">${e(contact.phone)}</a> or email <a href="mailto:${e(contact.email)}">${e(contact.email)}</a>.</p></div>`;

  const form = `<form class="stx-form" name="hotel-inquiry-${e(slug)}" data-st-form>
<div class="stx-field"><label for="${slug}-name">Full name <span aria-hidden="true">*</span></label><input id="${slug}-name" name="name" autocomplete="name" required aria-describedby="${slug}-name-err"><p class="stx-error" id="${slug}-name-err" data-st-error-for="name"></p></div>
<div class="stx-field"><label for="${slug}-email">Email <span aria-hidden="true">*</span></label><input id="${slug}-email" name="email" type="email" autocomplete="email" required aria-describedby="${slug}-email-err"><p class="stx-error" id="${slug}-email-err" data-st-error-for="email"></p></div>
<div class="stx-field"><label for="${slug}-phone">Phone</label><input id="${slug}-phone" name="phone" type="tel" autocomplete="tel" pattern="[0-9+()\\-. ]{7,}" aria-describedby="${slug}-phone-err"><p class="stx-error" id="${slug}-phone-err" data-st-error-for="phone"></p></div>
<div class="stx-field"><label for="${slug}-dates">Travel dates</label><input id="${slug}-dates" name="travel_dates" placeholder="e.g. March 12–19, flexible"></div>
<div class="stx-field"><label for="${slug}-guests">Number of guests</label><input id="${slug}-guests" name="guests" type="number" min="1" max="50" inputmode="numeric" aria-describedby="${slug}-guests-err"><p class="stx-error" id="${slug}-guests-err" data-st-error-for="guests"></p></div>
<div class="stx-field stx-field--full"><label for="${slug}-message">How can we help? <span aria-hidden="true">*</span></label><textarea id="${slug}-message" name="message" required aria-describedby="${slug}-message-err"></textarea><p class="stx-error" id="${slug}-message-err" data-st-error-for="message"></p></div>
<input type="hidden" name="subject" value="${e(`Hotel inquiry: ${hotel.name}`)}"><input type="hidden" name="property" value="${e(hotel.name)}">
<div class="stx-hp" aria-hidden="true"><label for="${slug}-hp">Leave this field empty</label><input id="${slug}-hp" name="_hp" tabindex="-1" autocomplete="off"></div>
<p class="stx-form-note">Fields marked * are required. We use your details only to respond to your inquiry; see our <a href="/privacy">privacy policy</a>. Rates, availability and offers are confirmed with the hotel before booking.</p>
<button class="stx-btn" type="submit">Send inquiry</button>
<p class="stx-status stx-status--ok" data-sb-success hidden role="status" tabindex="-1">Thank you. Your inquiry about ${e(hotel.name)} has been sent to Superior Travel Consultants.</p>
<p class="stx-status stx-status--err" data-sb-error hidden role="alert" tabindex="-1">Sorry, your inquiry could not be sent. Please try again, or contact us at ${e(contact.email)} or ${e(contact.phone)}.</p>
</form>`;

  return `${css(VH_CSS + HOTEL_CSS)}<div class="stx" data-st-generated="hotel:${e(slug)}">${banner}
<section class="stx-hotel-hero"><div class="stx-wrap"><nav class="stx-crumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/luxury-hotels-resorts">Featured Luxury Hotels &amp; Resorts</a><span aria-hidden="true">/</span><span aria-current="page">${e(hotel.name)}</span></nav><div class="stx-hotel-grid"><div><span class="stx-kicker">Featured hotel &amp; resort</span><h1>${e(hotel.name)}</h1>${loc ? `<p class="stx-loc">${e(loc)}</p>` : placeholder(draft, 'location')}<div class="stx-actions"><a class="stx-btn" href="#inquire">Inquire about this hotel</a><a class="stx-btn stx-btn--ghost" href="/team">Meet our advisors</a></div></div>${heroMedia}</div></div></section>
<section class="stx-section" aria-labelledby="${slug}-overview"><div class="stx-wrap"><h2 id="${slug}-overview">Overview</h2><div class="stx-prose">${hotel.overview ? paragraphs(hotel.overview) : placeholder(draft, 'hotel overview (client-supplied or verified)')}</div>${loc ? `<dl class="stx-facts"><div><dt>Location</dt><dd>${e(loc)}</dd></div>${hotel.location?.address ? `<div><dt>Address</dt><dd>${e(hotel.location.address)}</dd></div>` : ''}</dl>` : ''}</div></section>
${gallery}${amenitiesBlock}${offersBlock}${faqBlock}
<section class="stx-section" id="inquire" aria-labelledby="${slug}-inquire"><div class="stx-wrap"><h2 id="${slug}-inquire">Inquire about ${e(hotel.name)}</h2><p class="stx-sub">Share your dates and preferences and a Superior Travel advisor will follow up.</p><div class="stx-contact">${contactCard}${form}</div></div></section>
</div>`;
}
