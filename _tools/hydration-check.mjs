// Loads every page in headless Chrome and reports console errors, uncaught exceptions, failed
// hydration and missing enhancements. Requires the preview server (node _tools/serve.mjs).
// Usage: node _tools/hydration-check.mjs [baseUrl] [--mobile]
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ROOT, listDataFiles, loadPageData } from './lib.mjs';

const base = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:4173';
const mobile = process.argv.includes('--mobile');
const reduced = process.argv.includes('--reduced');
const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const chrome = chromePaths.find((p) => fs.existsSync(p));
if (!chrome) throw new Error('Chrome/Edge not found');

const only = process.argv.filter((a) => a.startsWith('/'));
const routes = only.length ? only : listDataFiles().map((f) => loadPageData(f).__ROUTE_PATH__).sort();
const port = 9300 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'st-check-'));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-extensions', 'about:blank'], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let version;
for (let i = 0; i < 50 && !version; i++) {
  version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json()).catch(() => null);
  if (!version) await sleep(200);
}
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 1;
const pending = new Map();
const listeners = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.sessionId && listeners.has(msg.sessionId)) listeners.get(msg.sessionId)(msg);
});
const send = (method, params = {}, sessionId) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });

// Preview analytics are disabled by the preview server; block any other third-party beacons.
const BLOCK = ['*googletagmanager.com*', '*google-analytics.com*', '*clarity.ms*', '*sentry.io*', '*localhost:8000*'];
const IGNORE = [/\[ClaimBanner\] Failed to fetch config/, /net::ERR_BLOCKED_BY_CLIENT/, /Failed to load resource/];

async function check(route) {
  const { result } = await send('Target.createTarget', { url: 'about:blank' });
  const { result: att } = await send('Target.attachToTarget', { targetId: result.targetId, flatten: true });
  const sid = att.sessionId;
  const issues = [];
  listeners.set(sid, (msg) => {
    if (msg.method === 'Runtime.consoleAPICalled' && ['error', 'assert'].includes(msg.params.type)) {
      const text = msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ');
      if (!IGNORE.some((re) => re.test(text))) issues.push(`console.${msg.params.type}: ${text.slice(0, 220)}`);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      issues.push(`exception: ${(d.exception?.description || d.text || '').split('\n')[0].slice(0, 220)}`);
    }
  });
  await send('Runtime.enable', {}, sid);
  await send('Network.enable', {}, sid);
  await send('Network.setBlockedURLs', { urls: BLOCK }, sid);
  if (mobile) await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sid);
  if (reduced) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sid);
  await send('Page.enable', {}, sid);
  await send('Page.navigate', { url: base + route }, sid);
  await sleep(3500);
  const { result: ev } = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const probe = document.querySelector('#root header button, #root header a');
      const hydrated = !!probe && Object.keys(probe).some((k) => k.startsWith('__reactProps$'));
      return {
        hydrated,
        search: !!document.querySelector('.st-search-trigger'),
        hiddenReveal: [...document.querySelectorAll('#root [data-layout-id]:not([data-layout-id^="header"]) [style*="opacity"]')]
          .filter((e) => getComputedStyle(e).opacity === '0' && e.getBoundingClientRect().height > 30 && !e.querySelector('button[aria-label="Back to top"]')).length,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
        height: document.documentElement.scrollHeight,
        title: document.title,
        runningAnimations: document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getComputedTiming().duration || 0) > 50).length,
      };
    })()`,
  }, sid);
  const v = ev.result.value || {};
  if (!v.hydrated) issues.push('not hydrated');
  if (!v.search) issues.push('search button missing');
  if (v.hiddenReveal) issues.push(`${v.hiddenReveal} reveal elements still hidden`);
  if (v.overflowX) issues.push('horizontal overflow');
  if (reduced && v.runningAnimations) issues.push(`${v.runningAnimations} CSS animations/transitions still running with reduced motion`);
  listeners.delete(sid);
  await send('Target.closeTarget', { targetId: result.targetId });
  return { route, issues, height: v.height };
}

const results = [];
const queue = [...routes];
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const r = queue.shift();
      results.push(await check(r));
    }
  }),
);
ws.close();
proc.kill();

const bad = results.filter((r) => r.issues.length).sort((a, b) => a.route.localeCompare(b.route));
console.log(`Checked ${results.length} pages${mobile ? ' (mobile 390px)' : ''}. Pages with issues: ${bad.length}.`);
for (const r of bad) console.log(`- ${r.route}\n    ${r.issues.join('\n    ')}`);
if (!only.length && base.includes('localhost')) {
  const heights = Object.fromEntries(results.sort((a, b) => a.route.localeCompare(b.route)).map((r) => [r.route, r.height]));
  fs.writeFileSync(path.join(ROOT, '_tools', 'reports', `page-heights${mobile ? '-mobile' : ''}.json`), `${JSON.stringify(heights, null, 2)}\n`);
}
process.exitCode = bad.length ? 1 : 0;
