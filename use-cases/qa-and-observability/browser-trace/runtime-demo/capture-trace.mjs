// Impact demo, powered by the REAL browser-trace skill.
//   A) Local Playwright         -> the UI test result: an assertion outcome.
//   B) Browserbase + browser-trace -> a second read-only CDP client records the
//      firehose; we read the skill's own console/exceptions + network/failed buckets.
//
//   node --env-file=../../.env capture-trace.mjs   (from runtime-demo/)  -> report.html
import { chromium } from 'playwright-core';
import { execSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { dataUrl, SOURCE, BUG_LINE } from './app.mjs';

const BT = process.env.BROWSER_TRACE_DIR;
if (!BT) throw new Error('Set BROWSER_TRACE_DIR to the browser-trace skill scripts directory.');
const RUN = 'rt-demo';
const O11Y = new URL(`./.o11y/${RUN}/`, import.meta.url).pathname;
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const sh = (cmd) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
const readLines = (p) => (existsSync(p) ? readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);

// ---------- A) LOCAL PLAYWRIGHT ----------
async function runPlaywright() {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 620 } });
  await p.goto(dataUrl, { waitUntil: 'domcontentloaded' });
  let result;
  try {
    await p.click('#add-btn');
    await p.locator('#list li:not(.empty)').waitFor({ state: 'visible', timeout: 4000 });
    result = { pass: true, detail: 'task appeared' };
  } catch (e) { result = { pass: false, detail: String(e).split('\n')[0] }; }
  const shot = 'data:image/png;base64,' + (await p.screenshot()).toString('base64');
  await b.close();
  return { result, shot };
}

// ---------- B) BROWSERBASE via the browser-trace SKILL ----------
function runBrowserTrace() {
  try { rmSync(O11Y, { recursive: true, force: true }); } catch {}
  console.log('  bb-capture --new (creates session + attaches read-only tracer)…');
  sh(`node ${BT}/bb-capture.mjs --new ${RUN}`);
  const manifest = JSON.parse(readFileSync(O11Y + 'manifest.json', 'utf8'));
  const sid = manifest.browserbase.session_id;
  const connect = JSON.parse(sh(`browse cloud sessions get ${sid}`)).connectUrl;
  console.log('  driving the buggy flow (browse open + click)…');
  try { sh('browse stop --session drv'); } catch {}   // clear any stale driver session
  sh(`browse open '${dataUrl}' --cdp '${connect}' --session drv`);
  sh(`browse click '#add-btn' --session drv`);
  sh('sleep 3');
  console.log('  stop + bisect + finalize…');
  sh(`node ${BT}/stop-capture.mjs ${RUN}`);
  sh(`node ${BT}/bisect-cdp.mjs ${RUN}`);
  try { sh(`node ${BT}/bb-finalize.mjs ${RUN} --release`); } catch {}

  // read the skill's OWN buckets
  const reqs = readLines(O11Y + 'cdp/network/requests.jsonl');
  const reqById = new Map(reqs.map((e) => [e.params?.requestId, e.params?.request]));
  const exceptions = readLines(O11Y + 'cdp/console/exceptions.jsonl').map((e) => {
    const d = e.params?.exceptionDetails || {};
    const desc = d.exception?.description || d.text || 'Uncaught';
    return { title: desc.split('\n')[0], line: d.lineNumber, fn: d.stackTrace?.callFrames?.[0]?.functionName };
  });
  const failed = readLines(O11Y + 'cdp/network/failed.jsonl').map((e) => {
    const r = reqById.get(e.params?.requestId) || {};
    return { method: r.method || '', url: r.url || '', status: 'failed · ' + (e.params?.errorText || 'error') };
  });
  const bad = readLines(O11Y + 'cdp/network/responses.jsonl')
    .filter((e) => e.params?.response?.status >= 400)
    .map((e) => ({ method: '', url: e.params.response.url, status: String(e.params.response.status) }));
  const summary = existsSync(O11Y + 'cdp/summary.json') ? JSON.parse(readFileSync(O11Y + 'cdp/summary.json', 'utf8')) : { totalEvents: 0 };
  return { exceptions, failures: [...failed, ...bad], sid, events: summary.totalEvents };
}

// ---------- report ----------
function report(pw, tr) {
  const signalCount = tr.exceptions.length + tr.failures.length;
  const signalSummary = signalCount
    ? `${tr.exceptions.length} exception(s), ${tr.failures.length} network observation(s)`
    : 'No exception or network observations recorded';
  const excHtml = tr.exceptions.map((e) => `<div class="err"><span class="x">✕</span> ${esc(e.title)}<div class="at">at ${esc(e.fn || 'anonymous')}()${e.line != null ? ' · line ' + e.line : ''}</div></div>`).join('') || '<div class="ok">none</div>';
  const netHtml = tr.failures.map((n) => `<div class="err"><span class="x">✕</span> ${esc(n.method || '')} ${esc((n.url || '').replace(/^https?:\/\//, '').slice(0, 60))} <b>${esc(n.status)}</b></div>`).join('') || '<div class="ok">no network failures</div>';
  const srcHtml = SOURCE.split('\n').map((l, i) => `<div class="ln${i + 1 === BUG_LINE ? ' bug' : ''}"><span class="g">${i + 1}</span>${esc(l)}</div>`).join('');
  const cmds = ['bb-capture.mjs --new    # session + read-only CDP tracer', 'browse open / click     # drive the buggy flow', 'stop-capture · bisect-cdp · bb-finalize'].map((c) => `<div>$ ${esc(c)}</div>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Runtime errors: Playwright vs browser-trace</title><style>
 :root{--cream:#f6f2ea;--ink:#141414;--muted:#6b6459;--line:#e2dccf;--bb:#f24e29;--red:#c0432a;--green:#177a45}
 *{box-sizing:border-box} body{margin:0;background:var(--cream);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.5}
 .wrap{max-width:1120px;margin:0 auto;padding:54px 44px}
 .brand{display:flex;align-items:center;gap:11px;margin-bottom:30px}
 .logo{width:32px;height:32px;background:var(--bb);border-radius:7px;color:#fff;font-weight:800;font-size:19px;display:flex;align-items:center;justify-content:center}
 .kicker{color:var(--bb);font-weight:800;font-size:12.5px;letter-spacing:1.5px;text-transform:uppercase}
 h1{font-size:40px;letter-spacing:-1px;margin:.15em 0 .1em;font-weight:800}
 .sub{font-size:17px;color:var(--muted);max-width:780px;margin:0 0 30px}
 .cols{display:grid;grid-template-columns:1fr 1fr;gap:22px}
 .col{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px;display:flex;flex-direction:column}
 .col.bb{border:2px solid var(--bb)}
 .tag{font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:3px 9px;border-radius:20px;align-self:flex-start}
 .tag.a{background:#f1e9dc;color:#7a5a2a}.tag.b{background:#fde6df;color:var(--bb)}
 .col h2{font-size:20px;margin:12px 0 2px;letter-spacing:-.3px} .col .m{font-size:13px;color:var(--muted);margin-bottom:14px}
 .verdict{font-weight:700;font-size:15px;padding:12px 14px;border-radius:10px;margin-bottom:14px}
 .verdict.blind{background:#fdeee9;color:var(--red)} .verdict.root{background:#e7f5ec;color:var(--green)}
 .shot{width:100%;border-radius:10px;border:1px solid var(--line);margin-top:auto}
 .err{background:#fff5f3;border:1px solid #f3cfc6;border-radius:9px;padding:10px 12px;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;margin:6px 0;color:#7a2216}
 .err .x{color:var(--red);font-weight:800;margin-right:6px} .err .at{color:#9a7a72;font-size:11px;margin-top:4px}
 .ok{color:var(--muted);font-size:13px}
 .lbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin:14px 0 6px}
 .code{background:#0f1117;border-radius:10px;padding:12px;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#cfe0ff;overflow:auto}
 .code .ln{white-space:pre} .code .g{display:inline-block;width:22px;color:#5b6270} .code .bug{background:#3a1420;color:#ffb3b3;border-radius:3px}
 .prov{margin-top:14px;font-size:11.5px;color:var(--muted);border-top:1px dashed var(--line);padding-top:10px}
 .prov b{color:var(--ink)} .prov .cmds{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#7a5a2a;margin-top:6px}
 .foot{margin-top:30px;background:#fff;border-left:4px solid var(--bb);border-radius:8px;padding:16px 18px;font-size:15px} .foot b{color:var(--bb)}
</style></head><body><div class="wrap">
 <div class="brand"><div class="logo">B</div><b>Browserbase</b><span style="color:var(--muted);font-size:13px">browser-trace · runtime errors</span></div>
 <div class="kicker">Same bug, two views</div>
 <h1>UI assertions and runtime observations</h1>
 <p class="sub">This fixture contains a planted runtime bug. The panels show an assertion result and separately collected runtime observations. These runs use different instrumentation and environments; this is a signal-capture demonstration.</p>
 <div class="cols">
  <div class="col">
   <span class="tag a">Local Playwright · the UI test result</span>
   <h2>${pw.result.pass ? "UI assertion passed" : "UI assertion failed"}</h2><div class="m">This test records an assertion and screenshot. It does not enable runtime error listeners.</div>
   <div class="verdict ${pw.result.pass ? "root" : "blind"}">${esc(pw.result.detail)}</div>
   <div class="lbl">Screenshot from this test</div>
   <img class="shot" src="${pw.shot}" alt="playwright screenshot"/>
   <div class="lbl" style="margin-top:14px">What the agent knows</div>
   <div class="ok">The assertion outcome does not identify a cause. Playwright can also collect runtime events when configured to do so.</div>
  </div>
  <div class="col bb">
   <span class="tag b">Browserbase · browser-trace (2nd read-only CDP client)</span>
   <h2>Recorded runtime observations.</h2><div class="m">Read from the skill's own capture buckets — console, exceptions, network.</div>
   <div class="verdict ${signalCount ? "root" : "blind"}">${esc(signalSummary)}</div>
   <div class="lbl">Uncaught exceptions · cdp/console/exceptions.jsonl</div>
   ${excHtml}
   <div class="lbl">Network · cdp/network/failed.jsonl</div>
   ${netHtml}
   <div class="lbl">Fixture source and planted line (supplied ground truth)</div>
   <div class="code">${srcHtml}</div>
   <div class="prov">Captured by the <b>browser-trace</b> skill · session <b>${esc(tr.sid || '')}</b> · <b>${tr.events}</b> CDP events
     <div class="cmds">${cmds}</div>
   </div>
  </div>
 </div>
 <div class="foot">No diagnosis or repair was verified. Captured events may be unrelated to the failing assertion. The highlighted source line is supplied by the fixture, not inferred from the trace. Empty observations do not establish the absence of a bug.</div>
</div></body></html>`;
}

console.log('A) Local Playwright…');
const pw = await runPlaywright();
console.log('   →', pw.result.detail);
console.log('B) Browserbase + browser-trace skill…');
const tr = runBrowserTrace();
console.log('   → exceptions:', tr.exceptions.length, '| network failures:', tr.failures.length, '| events:', tr.events);
writeFileSync(new URL('./report.html', import.meta.url), report(pw, tr));
console.log('\nReport written -> runtime-demo/report.html');
process.exit(0);
