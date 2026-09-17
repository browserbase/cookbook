// Signal-capture demonstration: assertion outcomes and observed runtime events.
//   Strategy A: Playwright (their setup) — run the UI test, keep pass/fail + message.
//   Strategy B: browser-trace — one reused BB session, read per-page CDP buckets.
//
//   node --env-file=../../../.env run-eval.mjs   (from runtime-demo/eval/)  -> report.html
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { CASES, dataUrlFor } from './cases.mjs';

const BT = process.env.BROWSER_TRACE_DIR;
if (!BT) throw new Error('Set BROWSER_TRACE_DIR to the browser-trace skill scripts directory.');
const RUN = 'eval-run';
const O11Y = new URL(`./.o11y/${RUN}/`, import.meta.url).pathname;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
const lines = (p) => (existsSync(p) ? readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);

// ---------- A) PLAYWRIGHT ----------
async function playwrightPass() {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const out = {};
  for (const c of CASES) {
    const p = await b.newPage({ viewport: { width: 820, height: 560 } });
    await p.goto(dataUrlFor(c), { waitUntil: 'domcontentloaded' });
    let r;
    try {
      await p.click('#go');
      if (c.check.kind === 'appear') { await p.locator(c.check.sel).waitFor({ state: 'visible', timeout: 3500 }); r = { pass: true, msg: 'element appeared' }; }
      else { const t = (await p.locator(c.check.sel).textContent())?.trim(); r = t === c.check.expect ? { pass: true, msg: 'value ok' } : { pass: false, msg: `expected "${c.check.expect}", got "${t}"` }; }
    } catch (e) { r = { pass: false, msg: String(e).split('\n')[0].replace('locator.waitFor: ', '') }; }
    await p.close();
    out[c.id] = r;
  }
  await b.close();
  return out;
}

// ---------- B) BROWSER-TRACE (one reused session) ----------
function tracePass() {
  try { rmSync(O11Y, { recursive: true, force: true }); } catch {}
  sh(`node ${BT}/bb-capture.mjs --new ${RUN}`);
  const sid = JSON.parse(readFileSync(O11Y + 'manifest.json', 'utf8')).browserbase.session_id;
  const connect = JSON.parse(sh(`browse cloud sessions get ${sid}`)).connectUrl;
  try { sh('browse stop --session drv'); } catch {}
  for (const c of CASES) {                    // reuse ONE session; each open = a new page bucket
    sh(`browse open '${dataUrlFor(c)}' --cdp '${connect}' --session drv`);
    sh(`browse click '#go' --session drv`);
    sh('sleep 2');
  }
  sh(`node ${BT}/stop-capture.mjs ${RUN}`);
  sh(`node ${BT}/bisect-cdp.mjs ${RUN}`);
  try { sh(`node ${BT}/bb-finalize.mjs ${RUN} --release`); } catch {}

  const summary = JSON.parse(readFileSync(O11Y + 'cdp/summary.json', 'utf8'));
  const dataPages = summary.pages.filter((p) => (p.url || '').startsWith('data:')).sort((a, b) => a.pageId - b.pageId);
  const expectedUrls = new Set(CASES.map(dataUrlFor));
  const unexpected = dataPages.filter(pg => !expectedUrls.has(pg.url)).length;
  const out = {};
  for (const c of CASES) {
    const matches = dataPages.filter(pg => pg.url === dataUrlFor(c));
    if (matches.length !== 1) {
      out[c.id] = { state: matches.length ? 'ambiguous' : 'missing', captured: null,
        detail: matches.length ? 'Multiple matching capture pages' : 'No matching capture page' };
      continue;
    }
    const pg = matches[0];
    const dir = O11Y + 'cdp/pages/' + String(pg.pageId).padStart(3, '0') + '/';
    const exc = lines(dir + 'console/exceptions.jsonl').map((e) => (e.params?.exceptionDetails?.exception?.description || e.params?.exceptionDetails?.text || '').split('\n')[0]);
    const failed = lines(dir + 'network/failed.jsonl').map((e) => e.params?.errorText);
    const badResp = lines(dir + 'network/responses.jsonl').filter((e) => e.params?.response?.status >= 400).map((e) => e.params.response.status);
    const cErr = lines(dir + 'console/logs.jsonl').filter((e) => e.params?.type === 'error').map((e) => (e.params.args || []).map((a) => a.value || a.description).join(' '));
    const captured = { exception: exc.filter(Boolean), network: [...failed.filter(Boolean), ...badResp.map((s) => 'HTTP ' + s)], console: cErr.filter(Boolean) };
    const observations = Object.entries(captured).flatMap(([kind, values]) => values.map(value => `${kind}: ${value}`));
    out[c.id] = { state: 'captured', captured, signalCount: observations.length,
      detail: observations.join(' | ') || 'No error signals recorded' };
  }
  return { out, sid, events: summary.totalEvents, unexpected,
    mapped: Object.values(out).filter(value => value.state === 'captured').length };

}

// ---------- report ----------
function report(pw, tr) {
  const rows = CASES.map((c) => {
    const P = pw[c.id], T = tr.out[c.id];
    const assertion = P ? (P.pass ? 'Assertion passed' : 'Assertion failed') : 'No assertion result';
    return `<tr>
      <td><b>${esc(c.category)}</b><div class="muted">Supplied fixture ground truth: ${esc(c.truth.root)}</div></td>
      <td>${assertion}<div class="mono">${esc(P?.msg || 'Not recorded')}</div></td>
      <td>${T?.state === 'captured' ? `${T.signalCount} error signal(s)` : 'Capture unavailable'}<div class="mono">${esc(T?.detail || 'No capture result')}</div></td>
    </tr>`;
  }).join('');
  const signals = CASES.filter(c => tr.out[c.id]?.state === 'captured' && tr.out[c.id].signalCount > 0).length;
  const captured = CASES.filter(c => tr.out[c.id]?.state === 'captured').length;
  const assertions = CASES.filter(c => pw[c.id]?.pass === false).length;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Eval · Playwright vs browser-trace</title><style>
 :root{--cream:#f6f2ea;--ink:#141414;--muted:#6b6459;--line:#e2dccf;--bb:#f24e29;--red:#c0432a;--green:#177a45;--amber:#a9791f}
 *{box-sizing:border-box} body{margin:0;background:var(--cream);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.5}
 .wrap{max-width:1080px;margin:0 auto;padding:54px 44px}
 .brand{display:flex;align-items:center;gap:11px;margin-bottom:26px}
 .logo{width:32px;height:32px;background:var(--bb);border-radius:7px;color:#fff;font-weight:800;font-size:19px;display:flex;align-items:center;justify-content:center}
 .kicker{color:var(--bb);font-weight:800;font-size:12.5px;letter-spacing:1.5px;text-transform:uppercase}
 h1{font-size:38px;letter-spacing:-1px;margin:.15em 0 .1em;font-weight:800}
 .sub{font-size:16px;color:var(--muted);max-width:800px;margin:0 0 26px}
 .score{display:flex;gap:16px;margin:0 0 26px}
 .sc{flex:1;background:#fff;border:1px solid var(--line);border-radius:14px;padding:18px 20px}
 .sc.bb{border:2px solid var(--bb)} .sc .n{font-size:34px;font-weight:800;letter-spacing:-1px} .sc .l{font-size:13px;color:var(--muted)}
 table{width:100%;border-collapse:collapse;background:#fff;border:1px solid var(--line);border-radius:14px;overflow:hidden}
 th,td{text-align:left;padding:13px 16px;border-bottom:1px solid var(--line);vertical-align:top;font-size:14px}
 th{font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted)} th.bb{color:var(--bb)}
 tr:last-child td{border-bottom:0} td:first-child{width:34%}
 .muted{color:var(--muted);font-size:12.5px;margin-top:3px} .mono{font-family:ui-monospace,Menlo,monospace;font-size:11.5px;color:#4a463d;margin-top:6px}
 .b{display:inline-block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;padding:3px 9px;border-radius:20px}
 .b.g{background:#e7f5ec;color:var(--green)} .b.a{background:#f7efdc;color:var(--amber)} .b.r{background:#fdeee9;color:var(--red)}
 .foot{margin-top:26px;background:#fff;border-left:4px solid var(--bb);border-radius:8px;padding:16px 18px;font-size:15px} .foot b{color:var(--bb)}
 .prov{margin-top:14px;font-size:11.5px;color:var(--muted)}
</style></head><body><div class="wrap">
 <div class="brand"><div class="logo">B</div><b>Browserbase</b><span style="color:var(--muted);font-size:13px">signal-capture demonstration</span></div>
 <div class="kicker">Playwright vs browser-trace</div>
 <h1>What did each configured run record?</h1>
 <p class="sub">Each row shows a local UI assertion and runtime telemetry from a separate Browserbase run. The instrumentation, environment and wait durations differ. These counts describe recorded signals; they do not measure diagnostic accuracy or compare browser capabilities.</p>
 <div class="score">
   <div class="sc"><div class="n">${assertions}/${CASES.length}</div><div class="l">Recorded failing UI assertions</div></div>
   <div class="sc bb"><div class="n">${signals}/${captured}</div><div class="l">Uniquely mapped captures with error signals (${CASES.length - captured} cases unavailable)</div></div>
 </div>
 <table>
  <tr><th>Bug</th><th>Playwright · UI test result</th><th class="bb">browser-trace · CDP capture</th></tr>
  ${rows}
 </table>
 <div class="foot">No diagnosis or repair was verified. An error may be unrelated to the planted bug, and an empty capture does not prove no bug exists. Fixture ground truth is displayed separately and never selects or scores observed signals. Playwright can collect runtime events when listeners are configured.</div>
 <div class="prov">Real run · browser-trace session <b>${esc(tr.sid || '')}</b> · ${tr.events} CDP events · ${tr.mapped} uniquely matched case pages in one reused session · ${tr.unexpected} unexpected data pages excluded.</div>
</div></body></html>`;
}

console.log('A) Playwright pass…');
const pw = await playwrightPass();
CASES.forEach((c) => console.log('   ', c.id, pw[c.id].pass ? 'PASS' : 'FAIL'));
console.log('B) browser-trace pass (one reused BB session)…');
const tr = tracePass();
CASES.forEach((c) => console.log('   ', c.id, tr.out[c.id]?.state, '·', (tr.out[c.id]?.detail || '').slice(0, 60)));
writeFileSync(new URL('./report.html', import.meta.url), report(pw, tr));
console.log('\nEval report -> eval/report.html');
process.exit(0);
