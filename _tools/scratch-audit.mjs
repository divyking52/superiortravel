import { listDataFiles, loadPageData, stripTags } from './lib.mjs';

const phrases = [/live availability/i, /support before/i, /guarantee/i, /immediate/i, /real-time/i, /instant(ly)? (confirm|book)/i];
for (const f of listDataFiles()) {
  if (f.includes('destinations--')) continue;
  const w = loadPageData(f);
  const ir = w.__ENRICHED_IR__;
  for (const [id, p] of Object.entries(ir.pages)) {
    const json = JSON.stringify(p);
    const text = stripTags(json.replace(/\\n/g, ' ').replace(/\\"/g, '"'));
    const hits = [];
    for (const re of phrases) {
      const g = new RegExp(re.source, 'gi');
      let m;
      while ((m = g.exec(text))) hits.push(text.slice(Math.max(0, m.index - 60), m.index + 80));
    }
    const sections = (p.sections || []).map((s) => s.layoutId).join(',');
    console.log(`${f.padEnd(62)} route=${w.__ROUTE_PATH__} id=${id} [${sections}]`);
    for (const h of hits) console.log('      >>', h);
  }
}
