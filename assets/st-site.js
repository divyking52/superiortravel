/* Superior Travel site enhancements: site search, agent directory filter, back-to-top focus,
   external links, form validation, partner-rail pause and reveal-animation removal.
   Loaded with `defer` immediately before the Storebox hydrate module, so the first block runs on
   the server-rendered DOM before React hydrates. Anything inserted into React-managed markup waits
   for hydration to finish. */
(function () {
  'use strict';

  var doc = document;
  var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var version = (function () {
    var s = doc.currentScript && doc.currentScript.src;
    return s && s.indexOf('?v=') > -1 ? s.split('?v=')[1] : '';
  })();

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function el(tag, attrs, html) {
    var n = doc.createElement(tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ------------------------------------------------------------------ */
  /* 1. Before hydration: keep scroll-reveal content visible, label main. */
  /** Tags hidden scroll-reveal wrappers in page content and footer (never header menus) so CSS keeps them visible. */
  function markReveal(scope) {
    var els = (scope || doc).querySelectorAll('[style*="opacity:0;"], [style$="opacity:0"], [style*="opacity: 0;"], [style$="opacity: 0"]');
    for (var i = 0; i < els.length; i++) {
      var e = els[i];
      if (e.hasAttribute('data-st-reveal') || !e.closest('#root')) continue;
      if (e.closest('[data-layout-id^="header"]') || e.closest('[role="dialog"], [role="menu"], [role="tooltip"]')) continue;
      if (e.querySelector(':scope > button[aria-label="Back to top"]')) continue;
      e.setAttribute('data-st-reveal', '');
    }
  }
  markReveal();
  var main = doc.querySelector('#root main');
  if (main && !main.id) {
    main.id = 'main-content';
    main.setAttribute('tabindex', '-1');
  } else if (!main) {
    var skip = doc.querySelector('.st-skip-link');
    if (skip) skip.setAttribute('href', '#root');
  }

  /** Runs `cb` once React has hydrated the header (or after a timeout if hydration never completes). */
  function onHydrated(cb) {
    var started = Date.now();
    (function check() {
      var probe = doc.querySelector('#root header button, #root header a');
      var done = probe && Object.keys(probe).some(function (k) { return k.indexOf('__reactProps$') === 0; });
      // Timers rather than animation frames: frames are paused in background tabs.
      if (done || Date.now() - started > 6000) setTimeout(cb, 50);
      else setTimeout(check, 80);
    })();
  }

  /* ------------------------------------------------------------------ */
  /* 2. External links open in a new tab.                                */
  var newTabNote = el('span', { id: 'st-newtab-note', hidden: '' }, 'Opens in a new tab');
  doc.body.appendChild(newTabNote);
  function externalize(scope) {
    var links = (scope || doc).querySelectorAll ? (scope || doc).querySelectorAll('a[href^="http"]') : [];
    for (var j = 0; j < links.length; j++) {
      var a = links[j];
      if (a.hostname === location.hostname || /(^|\.)superiortravel\.com$/i.test(a.hostname)) continue;
      if (!a.target) a.target = '_blank';
      var rel = (a.getAttribute('rel') || '').split(/\s+/).filter(Boolean);
      if (rel.indexOf('noopener') < 0) rel.push('noopener');
      if (rel.indexOf('noreferrer') < 0) rel.push('noreferrer');
      a.setAttribute('rel', rel.join(' '));
      if (a.target === '_blank' && !a.hasAttribute('aria-describedby') && !/new (tab|window)/i.test(a.getAttribute('aria-label') || '')) {
        a.setAttribute('aria-describedby', 'st-newtab-note');
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* 3. Back to top: honor reduced motion and move focus to the top.     */
  window.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('button[aria-label="Back to top"]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    var home = doc.querySelector('#root header a[href="/"]');
    if (home) home.focus({ preventScroll: true });
  }, true);

  /* ------------------------------------------------------------------ */
  /* 4. Site search.                                                     */
  var STOP = { the: 1, a: 1, an: 1, and: 1, of: 1, to: 1, in: 1, for: 1, on: 1, with: 1, my: 1, me: 1, is: 1, at: 1, or: 1 };
  var TYPES = ['Trip Type', 'Blog', 'Travel Journal', 'Destination', 'Advisor', 'Hotels & Resorts', 'Offer', 'Page'];
  var index = null;
  var indexPromise = null;
  var dialog = null;
  var lastTrigger = null;
  var shown = 20;

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function tokenize(q) {
    return norm(q).split(/[^a-z0-9°&]+/).filter(function (t) { return t && !STOP[t] && (t.length > 1 || /\d/.test(t)); })
      .map(function (t) { return t.length > 4 ? t.replace(/(ies)$/, 'y').replace(/([^s])s$/, '$1') : t; });
  }
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch('/assets/search-index.json' + (version ? '?v=' + version : ''), { credentials: 'same-origin' })
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (data) {
          data.entries.forEach(function (e) {
            e._t = norm(e.t);
            e._d = norm(e.d);
            e._b = norm(e.b);
            e._c = norm((e.c || []).map(function (id) { return data.categories[id] ? data.categories[id].t : ''; }).join(' ') + ' ' + e.k);
          });
          index = data;
          return data;
        });
      indexPromise.catch(function () { indexPromise = null; });
    }
    return indexPromise;
  }
  function score(e, tokens, phrase) {
    var s = 0;
    for (var k = 0; k < tokens.length; k++) {
      var t = tokens[k];
      if (e._t.indexOf(t) > -1) s += new RegExp('(^|[^a-z0-9])' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(e._t) ? 18 : 12;
      else if (e._c.indexOf(t) > -1) s += 9;
      else if (e._d.indexOf(t) > -1) s += 5;
      else if (e._b.indexOf(t) > -1) s += 1 + Math.min(e._b.split(t).length - 1, 6) * 0.4;
      else return 0;
    }
    if (phrase.length > 3 && e._t.indexOf(phrase) > -1) s += 15;
    if (e.k === 'Trip Type' && e._c.indexOf(phrase) > -1) s += 6;
    return s;
  }
  function highlight(text, tokens) {
    var out = esc(text);
    tokens.forEach(function (t) {
      if (t.length < 2) return;
      out = out.replace(new RegExp('(^|[^a-z0-9&#;])(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[a-z]*)', 'gi'), '$1<mark>$2</mark>');
    });
    return out;
  }
  function snippet(e, tokens) {
    if (!tokens.length || tokens.some(function (t) { return e._d.indexOf(t) > -1; }) || !e.b) return e.d || (e.b || '').slice(0, 180);
    var pos = -1;
    for (var k = 0; k < tokens.length && pos < 0; k++) pos = e._b.indexOf(tokens[k]);
    if (pos < 0) return e.d || e.b.slice(0, 180);
    var start = Math.max(0, pos - 80);
    return (start ? '…' : '') + e.b.slice(start, start + 200).replace(/^\S*\s/, start ? '' : '$&') + '…';
  }
  function fmtDate(iso) {
    try { return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }); } catch (x) { return ''; }
  }
  function suggestions() {
    if (!index) return '';
    var ids = Object.keys(index.categories);
    return '<ul class="st-search__chips">' + ids.map(function (id) {
      var c = index.categories[id];
      return '<li><a href="' + esc(c.u) + '">' + esc(c.t) + '</a></li>';
    }).join('') + '</ul>';
  }

  function buildDialog() {
    dialog = el('dialog', { class: 'st-search', id: 'st-search', 'aria-labelledby': 'st-search-title' });
    dialog.innerHTML =
      '<div class="st-search__panel">' +
      '<div class="st-search__head"><h2 id="st-search-title">Search Superior Travel</h2>' +
      '<button type="button" class="st-search__close" aria-label="Close search"><span aria-hidden="true">×</span></button></div>' +
      '<form class="st-search__form" role="search" aria-label="Site search">' +
      '<label class="st-vh" for="st-search-input">Search blogs, destinations, trip types, advisors and hotels</label>' +
      '<input id="st-search-input" type="search" name="q" autocomplete="off" spellcheck="false" placeholder="Try “Disney”, “river cruise” or an advisor’s name">' +
      '<label class="st-vh" for="st-search-type">Content type</label>' +
      '<select id="st-search-type"><option value="">All content</option>' +
      TYPES.map(function (t) { return '<option>' + esc(t) + '</option>'; }).join('') + '</select></form>' +
      '<p class="st-search__status" id="st-search-status" role="status" aria-live="polite"></p>' +
      '<ul class="st-search__results" id="st-search-results" aria-labelledby="st-search-title"></ul>' +
      '<button type="button" class="st-search__more" hidden>Show more results</button>' +
      '<div class="st-search__empty" hidden></div></div>';
    doc.body.appendChild(dialog);

    var input = dialog.querySelector('#st-search-input');
    var type = dialog.querySelector('#st-search-type');
    var timer = null;
    input.addEventListener('input', function () { clearTimeout(timer); shown = 20; timer = setTimeout(run, 120); });
    type.addEventListener('change', function () { shown = 20; run(); });
    dialog.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault();
      var first = dialog.querySelector('.st-search__results a');
      if (first) location.href = first.getAttribute('href');
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        var first = dialog.querySelector('.st-search__results a');
        if (first) { e.preventDefault(); first.focus(); }
      }
    });
    dialog.querySelector('.st-search__results').addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var links = Array.prototype.slice.call(dialog.querySelectorAll('.st-search__results a'));
      var at = links.indexOf(doc.activeElement);
      if (at < 0) return;
      e.preventDefault();
      if (e.key === 'ArrowDown' && links[at + 1]) links[at + 1].focus();
      if (e.key === 'ArrowUp') (links[at - 1] || input).focus();
    });
    dialog.querySelector('.st-search__close').addEventListener('click', closeSearch);
    dialog.querySelector('.st-search__more').addEventListener('click', function () { shown += 20; run(); });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) closeSearch(); });
    dialog.addEventListener('close', function () {
      doc.documentElement.style.overflow = '';
      if (lastTrigger && lastTrigger.focus) lastTrigger.focus();
    });
  }

  function run() {
    var input = dialog.querySelector('#st-search-input');
    var typeFilter = dialog.querySelector('#st-search-type').value;
    var list = dialog.querySelector('.st-search__results');
    var status = dialog.querySelector('.st-search__status');
    var empty = dialog.querySelector('.st-search__empty');
    var more = dialog.querySelector('.st-search__more');
    var q = input.value.trim();
    if (!index) {
      status.textContent = 'Loading search…';
      loadIndex().then(run, function () {
        status.textContent = '';
        list.innerHTML = '';
        empty.hidden = false;
        empty.innerHTML = '<p>Search is temporarily unavailable. You can browse the <a href="/blogs">blog</a>, <a href="/travel-journal">Travel Journal</a> or <a href="/destinations">destinations</a>, or <a href="/contact">contact us</a>.</p>';
      });
      return;
    }
    var tokens = tokenize(q);
    if (!tokens.length) {
      list.innerHTML = '';
      more.hidden = true;
      status.textContent = '';
      empty.hidden = false;
      empty.innerHTML = '<p>Search blog posts, Travel Journal guides, destinations, trip types, advisors and hotels. Or start with a trip type:</p>' + suggestions();
      return;
    }
    var phrase = norm(q);
    var results = [];
    index.entries.forEach(function (e) {
      if (typeFilter && e.k !== typeFilter) return;
      var s = score(e, tokens, phrase);
      if (s > 0) results.push({ e: e, s: s });
    });
    results.sort(function (a, b) { return b.s - a.s || String(b.e.p || '').localeCompare(String(a.e.p || '')); });
    if (!results.length) {
      list.innerHTML = '';
      more.hidden = true;
      status.textContent = 'No results for “' + q + '”' + (typeFilter ? ' in ' + typeFilter : '') + '.';
      empty.hidden = false;
      empty.innerHTML = '<p>Check the spelling, try a broader term such as a destination or trip type' + (typeFilter ? ', or search all content' : '') + '. You can also <a href="/contact">ask an advisor</a> directly.</p>' + suggestions();
      return;
    }
    empty.hidden = true;
    status.textContent = results.length + (results.length === 1 ? ' result' : ' results') + ' for “' + q + '”' + (typeFilter ? ' in ' + typeFilter : '') + '.';
    list.innerHTML = results.slice(0, shown).map(function (r) {
      var e = r.e;
      var cats = (e.c || []).map(function (id) { return index.categories[id] && index.categories[id].t; }).filter(Boolean);
      return '<li><a href="' + esc(e.u) + '">' +
        '<span class="st-search__type">' + esc(e.k) + (e.p ? ' · ' + esc(fmtDate(e.p)) : '') + '</span>' +
        '<span class="st-search__title">' + highlight(e.t, tokens) + '</span>' +
        '<span class="st-search__excerpt">' + highlight(snippet(e, tokens), tokens) + '</span>' +
        (cats.length ? '<span class="st-search__cats">Trip types: ' + esc(cats.slice(0, 4).join(', ')) + '</span>' : '') +
        '</a></li>';
    }).join('');
    more.hidden = results.length <= shown;
  }

  function openSearch(query, trigger) {
    if (!dialog) buildDialog();
    lastTrigger = trigger || doc.activeElement;
    var input = dialog.querySelector('#st-search-input');
    if (typeof query === 'string') input.value = query;
    if (!dialog.open) {
      if (dialog.showModal) dialog.showModal(); else dialog.setAttribute('open', '');
      doc.documentElement.style.overflow = 'hidden';
    }
    input.focus();
    input.select();
    loadIndex().then(run, run);
    run();
  }
  function closeSearch() {
    if (dialog && dialog.open) dialog.close ? dialog.close() : dialog.removeAttribute('open');
  }
  window.stOpenSearch = openSearch;

  function addSearchTrigger() {
    if (doc.querySelector('.st-search-trigger')) return;
    var toolbar = doc.querySelector('#root header .MuiToolbar-root');
    if (!toolbar) return;
    var btn = el('button', { type: 'button', class: 'st-search-trigger', 'aria-haspopup': 'dialog', 'aria-controls': 'st-search', 'aria-label': 'Search the site' },
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg><span class="st-search-trigger__label" aria-hidden="true">Search</span>');
    btn.addEventListener('click', function () { openSearch(undefined, btn); });
    var end = toolbar.lastElementChild;
    if (end && end !== toolbar.firstElementChild) end.insertBefore(btn, end.firstChild);
    else toolbar.appendChild(btn);
  }

  doc.addEventListener('keydown', function (e) {
    var tag = (e.target && e.target.tagName) || '';
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable);
    if ((e.key === '/' && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))) {
      e.preventDefault();
      openSearch();
    }
  });
  doc.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href="#search"]');
    if (a) { e.preventDefault(); openSearch(undefined, a); }
  });

  /* ------------------------------------------------------------------ */
  /* 5. Agent directory filter on /team.                                 */
  function setupTeamFilter() {
    if (!/^\/team\/?$/.test(location.pathname)) return;
    var directory = doc.querySelector('[data-section-id="team-directory"]');
    if (!directory || doc.querySelector('.st-agent-filter')) return;
    fetch('/assets/st-agents.json' + (version ? '?v=' + version : ''), { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) { buildTeamFilter(directory, data); })
      .catch(function () {});
  }

  function buildTeamFilter(directory, data) {
    var cards = Array.prototype.slice.call(doc.querySelectorAll('.team-member-card'));
    var items = cards.map(function (card) {
      var link = card.querySelector('a[href^="/team/"]');
      var slug = link ? link.getAttribute('href').split('/').pop() : '';
      var col = card.closest('.MuiGrid-root:not(.MuiGrid-container)') || card;
      col.setAttribute('data-st-agent', slug);
      return { slug: slug, card: card, col: col, link: link };
    }).filter(function (x) { return x.slug; });
    if (!items.length) return;

    var bySlug = {};
    data.agents.forEach(function (a) { bySlug[a.slug] = a; });
    var specialties = {};
    data.agents.forEach(function (a) { (a.specialties || []).forEach(function (s) { (specialties[s] = specialties[s] || []).push(a.slug); }); });
    var specNames = Object.keys(specialties).sort();

    var box = el('section', { class: 'st-agent-filter', 'aria-labelledby': 'st-agent-filter-title' });
    box.innerHTML =
      '<h2 id="st-agent-filter-title">Find an advisor</h2>' +
      '<div class="st-agent-filter__row">' +
      '<div><label for="st-agent-name">Search by name</label><input id="st-agent-name" type="search" autocomplete="off" placeholder="e.g. Carol"></div>' +
      '<div><label for="st-agent-specialty">Trip type or specialty</label><select id="st-agent-specialty"><option value="">All advisors</option>' +
      '<optgroup label="Trip types">' + data.categories.map(function (c) { return '<option value="cat:' + esc(c.id) + '">' + esc(c.title) + '</option>'; }).join('') + '</optgroup>' +
      '<optgroup label="Listed specialties">' + specNames.map(function (s) { return '<option value="spec:' + esc(s) + '">' + esc(s) + '</option>'; }).join('') + '</optgroup></select></div>' +
      '<div><label for="st-agent-jump">Go to an advisor</label><select id="st-agent-jump"><option value="">Choose an advisor…</option>' +
      data.agents.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (a) { return '<option value="' + esc(a.slug) + '">' + esc(a.name) + '</option>'; }).join('') +
      '</select></div></div>' +
      '<p class="st-agent-filter__status" role="status" aria-live="polite"></p>' +
      '<p class="st-agent-filter__empty" hidden>No advisors match. <button type="button" class="st-agent-filter__clear">Clear filters</button></p>';

    var grid = directory.querySelector('.MuiGrid-container');
    (grid && grid.parentNode ? grid.parentNode : directory).insertBefore(box, grid || directory.firstChild);

    var nameInput = box.querySelector('#st-agent-name');
    var specSelect = box.querySelector('#st-agent-specialty');
    var jump = box.querySelector('#st-agent-jump');
    var status = box.querySelector('.st-agent-filter__status');
    var empty = box.querySelector('.st-agent-filter__empty');

    function apply() {
      var q = norm(nameInput.value.trim());
      var spec = specSelect.value;
      var allowed = null;
      var label = '';
      var catUrl = '';
      if (spec.indexOf('cat:') === 0) {
        var cat = data.categories.filter(function (c) { return c.id === spec.slice(4); })[0];
        allowed = cat ? cat.agents : [];
        label = cat ? cat.title : '';
        catUrl = cat ? cat.url : '';
      } else if (spec.indexOf('spec:') === 0) {
        allowed = specialties[spec.slice(5)] || [];
        label = spec.slice(5);
      }
      var count = 0;
      items.forEach(function (it) {
        var a = bySlug[it.slug] || { name: it.card.textContent };
        var ok = (!allowed || allowed.indexOf(it.slug) > -1) && (!q || norm(a.name).indexOf(q) > -1);
        if (ok) { it.col.removeAttribute('hidden'); count++; } else it.col.setAttribute('hidden', '');
      });
      ['team-directory', 'team-owners'].forEach(function (id) {
        var sec = doc.querySelector('[data-section-id="' + id + '"]');
        if (!sec) return;
        var visible = sec.querySelectorAll('[data-st-agent]:not([hidden])').length;
        if (id === 'team-owners') { if (visible) sec.removeAttribute('hidden'); else sec.setAttribute('hidden', ''); }
      });
      var filtered = !!(q || spec);
      empty.hidden = count > 0 || !filtered;
      status.innerHTML = filtered && count
        ? 'Showing ' + count + ' of ' + items.length + ' advisors' + (label ? ' for <strong>' + esc(label) + '</strong>' : '') + (q ? ' matching “' + esc(nameInput.value.trim()) + '”' : '') + '.' +
          (catUrl ? ' <a href="' + esc(catUrl) + '">View the ' + esc(label) + ' page</a>' : '') +
          ' <button type="button" class="st-agent-filter__clear">Clear filters</button>'
        : '';
      try {
        var url = new URL(location.href);
        if (spec.indexOf('cat:') === 0) url.searchParams.set('specialty', spec.slice(4)); else url.searchParams.delete('specialty');
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      } catch (x) {}
    }
    function clear() {
      nameInput.value = '';
      specSelect.value = '';
      apply();
      nameInput.focus();
    }
    nameInput.addEventListener('input', apply);
    specSelect.addEventListener('change', apply);
    box.addEventListener('click', function (e) { if (e.target.closest('.st-agent-filter__clear')) clear(); });
    jump.addEventListener('change', function () {
      var slug = jump.value;
      if (!slug) return;
      var it = items.filter(function (x) { return x.slug === slug; })[0];
      if (!it) { location.href = '/team/' + slug; return; }
      if (it.col.hasAttribute('hidden')) { nameInput.value = ''; specSelect.value = ''; apply(); }
      it.col.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      it.col.setAttribute('data-st-highlight', '');
      setTimeout(function () { it.col.removeAttribute('data-st-highlight'); }, 2600);
      if (it.link) it.link.focus({ preventScroll: true });
    });

    var pre = new URLSearchParams(location.search).get('specialty');
    if (pre && data.categories.some(function (c) { return c.id === pre; })) { specSelect.value = 'cat:' + pre; apply(); }
  }

  /* ------------------------------------------------------------------ */
  /* 6. Generated inquiry forms: inline validation before the Storebox  */
  /*    form handler posts to the CRM.                                   */
  var MESSAGES = {
    valueMissing: function (label) { return 'Please enter ' + label + '.'; },
    typeMismatch: function () { return 'Please enter a valid email address.'; },
    patternMismatch: function () { return 'Please enter a valid phone number.'; },
    rangeUnderflow: function () { return 'Please enter a number of at least 1.'; },
    rangeOverflow: function () { return 'Please enter a smaller number.'; },
    badInput: function () { return 'Please enter a number.'; },
  };
  function fieldLabel(f) {
    var l = f.id && doc.querySelector('label[for="' + f.id + '"]');
    return l ? l.textContent.replace('*', '').trim().toLowerCase().replace(/^how can we help\?$/, 'a message') : 'this field';
  }
  function validateField(f) {
    var out = f.form.querySelector('[data-st-error-for="' + f.name + '"]');
    var msg = '';
    if (!f.validity.valid) {
      for (var key in MESSAGES) if (f.validity[key]) { msg = MESSAGES[key](fieldLabel(f)); break; }
      if (!msg) msg = f.validationMessage;
    }
    if (out) out.textContent = msg;
    if (msg) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid');
    return !msg;
  }
  function setupForms() {
    var forms = doc.querySelectorAll('form[data-st-form]');
    for (var k = 0; k < forms.length; k++) forms[k].setAttribute('novalidate', '');
  }
  doc.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || !form.matches || !form.matches('form[data-st-form]')) return;
    var fields = form.querySelectorAll('input:not([type="hidden"]):not([name="_hp"]), textarea, select');
    var firstBad = null;
    for (var k = 0; k < fields.length; k++) if (!validateField(fields[k]) && !firstBad) firstBad = fields[k];
    if (firstBad) {
      e.preventDefault();
      e.stopPropagation();
      firstBad.focus();
    }
  }, true);
  doc.addEventListener('input', function (e) {
    var f = e.target;
    if (f && f.form && f.form.matches('form[data-st-form]') && f.getAttribute('aria-invalid') === 'true') validateField(f);
  });
  /* The Storebox contact form shows the raw API error ("Unknown error") without an alert role. */
  var GENERIC_ERROR = /^(unknown error|failed to submit form|network error|request failed.*|something went wrong.*)$/i;
  var FRIENDLY_ERROR = 'Sorry, your message could not be sent. Please try again in a moment, or email inquiries@superiortravel.com or call (516) 224-7880.';
  function improveFormErrors() {
    var paragraphs = doc.querySelectorAll('#root form p');
    for (var k = 0; k < paragraphs.length; k++) {
      var p = paragraphs[k];
      var node = p.firstChild;
      if (!node || node.nodeType !== 3 || p.childNodes.length !== 1 || !GENERIC_ERROR.test(node.nodeValue.trim())) continue;
      if (p.parentElement && !p.parentElement.hasAttribute('role')) p.parentElement.setAttribute('role', 'alert');
      node.nodeValue = FRIENDLY_ERROR;
    }
  }

  ['sb-form:success', 'sb-form:error'].forEach(function (name) {
    doc.addEventListener(name, function (e) {
      var form = e.target;
      setTimeout(function () {
        var msg = form.querySelector(name === 'sb-form:success' ? '[data-sb-success]' : '[data-sb-error]');
        if (msg && !msg.hidden) msg.focus();
      }, 30);
    });
  });

  /* ------------------------------------------------------------------ */
  /* 7. Partner rail pause toggle and offer expiry.                      */
  doc.addEventListener('click', function (e) {
    var btn = e.target && e.target.closest && e.target.closest('[data-st-rail-toggle]');
    if (!btn) return;
    var viewport = btn.previousElementSibling;
    if (!viewport) return;
    var paused = viewport.classList.toggle('st-paused');
    btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    btn.textContent = paused ? 'Play logo animation' : 'Pause logo animation';
  });
  function expireOffers() {
    var today = new Date().toISOString().slice(0, 10);
    var groups = doc.querySelectorAll('[data-st-offers]');
    for (var k = 0; k < groups.length; k++) {
      var offers = groups[k].querySelectorAll('[data-st-expires]');
      var live = 0;
      for (var m = 0; m < offers.length; m++) {
        if (offers[m].getAttribute('data-st-expires') < today) offers[m].hidden = true; else live++;
      }
      var emptyMsg = groups[k].querySelector('[data-st-offers-empty]');
      if (emptyMsg && offers.length && !live) emptyMsg.hidden = false;
    }
  }

  /* ------------------------------------------------------------------ */
  externalize(doc);
  setupForms();
  expireOffers();
  onHydrated(function () {
    // Sections React re-renders on the client (e.g. after a Storebox hydration mismatch) get new reveal wrappers.
    markReveal();
    addSearchTrigger();
    setupTeamFilter();
    externalize(doc);
    setupForms();
    if (/^#search(=|$)/.test(location.hash)) openSearch(decodeURIComponent(location.hash.split('=')[1] || ''));
    if ('MutationObserver' in window) {
      var pending = false;
      new MutationObserver(function () {
        if (pending) return;
        pending = true;
        setTimeout(function () {
          pending = false;
          markReveal();
          externalize(doc);
          addSearchTrigger();
          improveFormErrors();
        }, 60);
      }).observe(doc.getElementById('root') || doc.body, { childList: true, subtree: true });
    }
  });
})();
