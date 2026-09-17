// Run the SAME buggy flow two ways and produce a side-by-side impact report:
//   A) Local Playwright  -> what a generated UI test returns: an assertion outcome.
//   B) Browserbase + CDP -> a read-only capture of runtime signals.
//
//   node --env-file=../../.env capture.mjs   (from runtime-demo/)  -> report.html
import Browserbase from '@browserbasehq/sdk';
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
import { dataUrl, SOURCE, BUG_LINE } from './app.mjs';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const cleanStack = (t) => String(t).replace(/data:text\/html;base64,[A-Za-z0-9+/=]+/g, 'app.js').replace(/\s+at\s+/g, '\n    at ');

// ---------- A) LOCAL PLAYWRIGHT: what the UI test actually returns ----------
async function runPlaywright() {
  const b = await chromium.launch({ channel: 'chrome', headless: true });
  const p = await b.newPage({ viewport: { width: 900, height: 620 } });
  await p.goto(dataUrl, { waitUntil: 'domcontentloaded' });
  let result;
  try {
    await p.click('#add-btn');
    await p.locator('#list li:not(.empty)').waitFor({ state: 'visible', timeout: 4000 });
    result = { pass: true, detail: 'task appeared' };
  } catch (e) {
    result = { pass: false, detail: String(e).split('\n')[0] };
  }
  const shot = 'data:image/png;base64,' + (await p.screenshot()).toString('base64');
  await b.close();
  return { result, shot };
}

// ---------- B) BROWSERBASE + CDP TRACE: the read-only firehose ----------
async function runBrowserbaseTrace() {
  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
  const session = await bb.sessions.create();
  const browser = await chromium.connectOverCDP(session.connectUrl);
  const ctx = browser.contexts()[0];
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const cdp = await ctx.newCDPSession(page);   // the second, read-only CDP client

  const exceptions = [], network = [], consoles = [];
  await cdp.send('Runtime.enable'); await cdp.send('Network.enable'); await cdp.send('Log.enable');
  cdp.on('Runtime.exceptionThrown', (e) => { const d = e.exceptionDetails; exceptions.push({ text: d.exception?.description || d.text, line: d.lineNumber }); });
  cdp.on('Runtime.consoleAPICalled', (e) => { if (e.type === 'error') consoles.push(e.args.map((a) => a.value || a.description).join(' ')); });
  cdp.on('Network.requestWillBeSent', (e) => { network.push({ id: e.requestId, method: e.request.method, url: e.request.url, status: 'pending' }); });
  cdp.on('Network.responseReceived', (e) => { const r = network.find((n) => n.id === e.requestId); if (r) r.status = e.response.status; });
  cdp.on('Network.loadingFailed', (e) => { const r = network.find((n) => n.id === e.requestId); if (r) r.status = 'failed: ' + e.errorText; });

  await page.goto(dataUrl, { waitUntil: 'domcontentloaded' });
  await page.click('#add-btn');
  await page.waitForTimeout(2500);
  await browser.close().catch(() => {});
  const failures = network.filter((n) => n.status === 'pending' || String(n.status).startsWith('failed') || Number(n.status) >= 400);
  return { exceptions, failures, consoles, sessionId: session.id };
}

// ---------- report ----------
function report(pw, tr) {
  const signalCount = tr.exceptions.length + tr.failures.length;
  const signalSummary = signalCount
    ? `${tr.exceptions.length} exception(s), ${tr.failures.length} network observation(s)`
    : 'No exception or network observations recorded';
  const excHtml = tr.exceptions.map((e) => `<div class="err"><span class="x">✕</span> ${esc(cleanStack(e.text).split('\n')[0])}<div class="at">${esc(cleanStack(e.text).split('\n').slice(1).join('\n')) || ''}</div></div>`).join('');
  const netHtml = tr.failures.map((n) => `<div class="err"><span class="x">✕</span> ${esc(n.method || 'GET')} ${esc((n.url || '').replace(/^https?:\/\//, ''))} <b>${esc(String(n.status))}</b></div>`).join('') || '<div class="ok">no network failures</div>';
  const srcHtml = SOURCE.split('\n').map((l, i) => `<div class="ln${i + 1 === BUG_LINE ? ' bug' : ''}"><span class="g">${i + 1}</span>${esc(l)}</div>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Runtime errors: Playwright vs the CDP trace</title><style>
 :root{--cream:#f6f2ea;--ink:#141414;--muted:#6b6459;--line:#e2dccf;--bb:#f24e29;--red:#c0432a;--green:#177a45}
 *{box-sizing:border-box} body{margin:0;background:var(--cream);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif;line-height:1.5}
 .wrap{max-width:1120px;margin:0 auto;padding:54px 44px}
 .brand{display:flex;align-items:center;gap:11px;margin-bottom:30px}
 .logo{width:32px;height:32px;background:var(--bb);border-radius:7px;color:#fff;font-weight:800;font-size:19px;display:flex;align-items:center;justify-content:center}
 .kicker{color:var(--bb);font-weight:800;font-size:12.5px;letter-spacing:1.5px;text-transform:uppercase}
 h1{font-size:40px;letter-spacing:-1px;margin:.15em 0 .1em;font-weight:800}
 .sub{font-size:17px;color:var(--muted);max-width:760px;margin:0 0 30px}
 .cols{display:grid;grid-template-columns:1fr 1fr;gap:22px}
 .col{background:#fff;border:1px solid var(--line);border-radius:16px;padding:22px;display:flex;flex-direction:column}
 .col.bb{border:2px solid var(--bb)}
 .tag{font-size:11px;font-weight:800;letter-spacing:.5px;text-transform:uppercase;padding:3px 9px;border-radius:20px;align-self:flex-start}
 .tag.a{background:#f1e9dc;color:#7a5a2a}.tag.b{background:#fde6df;color:var(--bb)}
 .col h2{font-size:20px;margin:12px 0 2px;letter-spacing:-.3px} .col .m{font-size:13px;color:var(--muted);margin-bottom:14px}
 .verdict{font-weight:700;font-size:15px;padding:12px 14px;border-radius:10px;margin-bottom:14px}
 .verdict.blind{background:#fbeceA;background:#fdeee9;color:var(--red)} .verdict.root{background:#e7f5ec;color:var(--green)}
 .shot{width:100%;border-radius:10px;border:1px solid var(--line);margin-top:auto}
 .err{background:#fff5f3;border:1px solid #f3cfc6;border-radius:9px;padding:10px 12px;font-family:ui-monospace,Menlo,monospace;font-size:12.5px;margin:6px 0;color:#7a2216}
 .err .x{color:var(--red);font-weight:800;margin-right:6px} .err .at{color:#9a7a72;font-size:11px;white-space:pre-wrap;margin-top:4px}
 .ok{color:var(--muted);font-size:13px}
 .lbl{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;color:var(--muted);margin:14px 0 6px}
 .code{background:#0f1117;border-radius:10px;padding:12px;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#cfe0ff;overflow:auto}
 .code .ln{white-space:pre} .code .g{display:inline-block;width:22px;color:#5b6270} .code .bug{background:#3a1420;color:#ffb3b3;border-radius:3px}
 .foot{margin-top:30px;background:#fff;border-left:4px solid var(--bb);border-radius:8px;padding:16px 18px;font-size:15px}
 .foot b{color:var(--bb)}
</style></head><body><div class="wrap">
 <div class="brand"><div class="logo">B</div><b>Browserbase</b><span style="color:var(--muted);font-size:13px">record → fix · runtime errors</span></div>
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
   <span class="tag b">Browserbase · second read-only CDP client</span>
   <h2>Recorded runtime observations.</h2><div class="m">Captured live from the same session — console, exceptions, network.</div>
   <div class="verdict ${signalCount ? "root" : "blind"}">${esc(signalSummary)}</div>
   <div class="lbl">Uncaught exceptions</div>
   ${excHtml || '<div class="ok">none</div>'}
   <div class="lbl">Network</div>
   ${netHtml}
   <div class="lbl">Fixture source and planted line (supplied ground truth)</div>
   <div class="code">${srcHtml}</div>
  </div>
 </div>
 <div class="foot">No diagnosis or repair was verified. Captured events may be unrelated to the failing assertion. The highlighted source line is supplied by the fixture, not inferred from the trace. Empty observations do not establish the absence of a bug.</div>
</div></body></html>`;
}

console.log('Running local Playwright…');
const pw = await runPlaywright();
console.log('  →', pw.result.detail);
console.log('Running Browserbase + CDP trace…');
const tr = await runBrowserbaseTrace();
console.log('  → exceptions:', tr.exceptions.length, '| network failures:', tr.failures.length);
writeFileSync(new URL('./report.html', import.meta.url), report(pw, tr));
console.log('\nReport written -> runtime-demo/report.html');
process.exit(0);
