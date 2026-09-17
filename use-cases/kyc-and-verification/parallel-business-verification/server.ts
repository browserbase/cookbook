// Minimal local dev server for the KYB demo UI.
//   GET /     → HTML page with a Run button and three iframes
//   GET /run  → SSE stream that drives runKyb() and emits live-session URLs +
//               the final JSON report.
//
// Usage: pnpm dev → open http://localhost:3000

import "dotenv/config";
import http from "node:http";
import { runKyb, type KybEvent } from "./kyb-parallel.js";

const PORT = Number(process.env.PORT ?? 3000);

const html = /* html */ `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>KYB Demo - Merchant Onboarding Verification</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 24px;
           background: #0b1a30; color: #e6ecf3; }
    h1 { margin: 0 0 4px; font-size: 22px; color: #ffffff; }
    .sub { color: #9bb0c8; font-size: 14px; margin-bottom: 18px; }
    .controls { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; }
    button { padding: 10px 18px; font-size: 15px; font-weight: 600; cursor: pointer;
             border: 1px solid #3b82f6; background: #2563eb; color: #ffffff; border-radius: 6px; }
    button:hover:not(:disabled) { background: #1d4ed8; }
    button:disabled { opacity: 0.45; cursor: not-allowed; }
    .status { font-size: 14px; color: #b8c8db; }
    .views { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
             height: 46vh; min-height: 320px; }
    .view { border: 1px solid #1e3358; border-radius: 8px; overflow: hidden;
            display: flex; flex-direction: column; background: #112740; }
    .view-header { padding: 8px 12px; background: #16304f; color: #ffffff; font-weight: 600;
                   font-size: 13px; border-bottom: 1px solid #1e3358;
                   display: flex; justify-content: space-between; align-items: center; }
    .badge { font-size: 11px; padding: 2px 8px; border-radius: 999px;
             background: #1e3358; color: #cbd8ea; }
    .badge.live { background: #1c4732; color: #6fdc8c; }
    .badge.done.pass { background: #1c4732; color: #6fdc8c; }
    .badge.done.fail { background: #4a1d27; color: #ff8585; }
    .view-frame { flex: 1; position: relative; min-height: 140px; background: #0b1a30; }
    .view-frame iframe { width: 100%; height: 100%; border: 0; }
    .placeholder { position: absolute; inset: 0; display: flex; align-items: center;
                   justify-content: center; color: #6a829c; font-size: 13px; }
    .view-details { border-top: 1px solid #1e3358; padding: 10px 12px;
                    font-size: 12px; color: #e6ecf3; background: #112740;
                    max-height: 36%; overflow: auto; }
    .view-details.hidden { display: none; }
    .view-details .reason { font-weight: 600; margin-bottom: 6px; }
    .view-details .reason.pass { color: #6fdc8c; }
    .view-details .reason.fail { color: #ff8585; }
    .view-details dl { display: grid; grid-template-columns: max-content 1fr;
                       gap: 2px 10px; margin: 0; }
    .view-details dt { color: #8aa0bb; font-weight: 500; }
    .view-details dd { margin: 0; color: #e6ecf3; word-break: break-word; }
    .view-details ul { margin: 4px 0 0; padding-left: 18px; }
    .view-details li { margin: 1px 0; }
    .view-details .took { margin-top: 6px; color: #6a829c; font-size: 11px; }
    .report { margin-top: 18px; padding: 14px; border: 1px solid #1e3358;
              border-radius: 8px; background: #112740; color: #e6ecf3; }
    .verdict { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    .verdict.pass { color: #6fdc8c; }
    .verdict.fail { color: #ff8585; }
    .summary-headline { font-size: 14px; color: #cbd8ea; margin: 4px 0 10px; }
    .summary-table { width: 100%; border-collapse: collapse; font-size: 13px;
                     margin-bottom: 14px; background: transparent; }
    .summary-table th, .summary-table td {
      text-align: left; padding: 8px 10px; border-bottom: 1px solid #1e3358;
      vertical-align: top; color: #e6ecf3;
    }
    .summary-table th { background: #16304f; font-weight: 600; color: #cbd8ea;
                        font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .summary-table tr:last-child td { border-bottom: 0; }
    .summary-table td.status { white-space: nowrap; font-weight: 600; }
    .summary-table td.status.pass { color: #6fdc8c; }
    .summary-table td.status.fail { color: #ff8585; }
    .summary-table td.finding { color: #e6ecf3; }
    .summary-table td.finding code { background: #16304f; color: #cbd8ea;
                                     padding: 1px 5px; border-radius: 3px; font-size: 12px; }
    details.raw { margin-top: 4px; }
    details.raw summary { cursor: pointer; color: #9bb0c8; font-size: 12px;
                          padding: 4px 0; }
    pre { white-space: pre-wrap; word-break: break-word; font-size: 12px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          margin: 0; max-height: 280px; overflow: auto;
          color: #cbd8ea; background: #0b1a30; padding: 10px; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>KYB Demo - Merchant Onboarding Verification</h1>
  <div class="sub">Three KYB checks run concurrently on three Browserbase sessions.</div>

  <div class="controls">
    <button id="run">Run KYB checks</button>
    <span class="status" id="status">Idle.</span>
  </div>

  <div class="views">
    <div class="view" data-key="DE SoS">
      <div class="view-header">
        <span>Delaware Secretary of State</span>
        <span class="badge" id="badge-DE SoS">waiting</span>
      </div>
      <div class="view-frame">
        <div class="placeholder">Click "Run KYB checks" to start.</div>
      </div>
      <div class="view-details hidden"></div>
    </div>
    <div class="view" data-key="OFAC  ">
      <div class="view-header">
        <span>OFAC SDN sanctions</span>
        <span class="badge" id="badge-OFAC  ">waiting</span>
      </div>
      <div class="view-frame">
        <div class="placeholder">Click "Run KYB checks" to start.</div>
      </div>
      <div class="view-details hidden"></div>
    </div>
    <div class="view" data-key="USPTO ">
      <div class="view-header">
        <span>USPTO trademark search</span>
        <span class="badge" id="badge-USPTO ">waiting</span>
      </div>
      <div class="view-frame">
        <div class="placeholder">Click "Run KYB checks" to start.</div>
      </div>
      <div class="view-details hidden"></div>
    </div>
  </div>

  <div class="report" id="report" style="display:none">
    <div class="verdict" id="verdict"></div>
    <div class="summary-headline" id="summaryHeadline"></div>
    <table class="summary-table" id="summaryTable">
      <thead>
        <tr>
          <th style="width: 22%">Check</th>
          <th style="width: 14%">Result</th>
          <th>Finding</th>
        </tr>
      </thead>
      <tbody id="summaryBody"></tbody>
    </table>
    <details class="raw">
      <summary>Raw JSON report</summary>
      <pre id="json"></pre>
    </details>
  </div>

  <script>
    const btn = document.getElementById('run');
    const statusEl = document.getElementById('status');
    const reportEl = document.getElementById('report');
    const verdictEl = document.getElementById('verdict');
    const jsonEl = document.getElementById('json');

    function viewFor(key) { return document.querySelector('.view[data-key="' + key + '"]'); }
    function badgeFor(key) { return document.getElementById('badge-' + key); }
    function frameOf(view) { return view.querySelector('.view-frame'); }
    function detailsOf(view) { return view.querySelector('.view-details'); }

    function esc(v) {
      if (v === null || v === undefined) return '—';
      return String(v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function renderDetails(result) {
      const passClass = result.pass ? 'pass' : 'fail';
      const tick = result.pass === null ? '?' : result.pass ? '✓' : '✗';
      let body = '';
      if (result.check === 'delaware_sos') {
        const reason = result.pass
          ? 'Active Delaware-registered entity matched by name'
          : 'No matching entity in Delaware Division of Corporations';
        body =
          '<div class="reason ' + passClass + '">' + tick + ' ' + reason + '</div>' +
          '<dl>' +
            '<dt>File #</dt><dd>' + esc(result.fileNumber) + '</dd>' +
            '<dt>Entity name</dt><dd>' + esc(result.entityName) + '</dd>' +
            '<dt>Result rows</dt><dd>' + esc(result.totalResults) + '</dd>' +
          '</dl>';
      } else if (result.check === 'ofac_sdn') {
        const reason = result.pass === null ? 'Unknown: search evidence is incomplete or inconsistent' : result.pass
          ? 'No matches displayed for this name query'
          : 'Matches displayed for this name query';
        const matchesHtml = (result.matches || []).length
          ? '<ul>' + result.matches.map((m) => '<li>' + esc(m) + '</li>').join('') + '</ul>'
          : result.pass === null ? '<dd>Unknown</dd>' : '<dd>(none)</dd>';
        body =
          '<div class="reason ' + passClass + '">' + tick + ' ' + reason + '</div>' +
          '<dl>' +
            '<dt>Match count</dt><dd>' + esc(result.matchCount) + '</dd>' +
            '<dt>Matched names</dt><dd>' + matchesHtml + '</dd>' +
          '</dl>';
      } else if (result.check === 'uspto_trademark') {
        let reason;
        if (result.pass) {
          reason = 'Live US trademarks owned by Anker Innovations';
        } else if (!result.liveCount) {
          reason = 'No live trademarks found for this brand';
        } else if (!result.ownsBrand) {
          reason = 'Live trademarks exist but none owned by Anker Innovations';
        } else {
          reason = 'USPTO check failed';
        }
        const owners = (result.topOwners || []).length
          ? '<ul>' + result.topOwners.map((o) => '<li>' + esc(o) + '</li>').join('') + '</ul>'
          : result.pass === null ? '<dd>Unknown</dd>' : '<dd>(none)</dd>';
        body =
          '<div class="reason ' + passClass + '">' + tick + ' ' + reason + '</div>' +
          '<dl>' +
            '<dt>Live count</dt><dd>' + esc(result.liveCount) + '</dd>' +
            '<dt>Owns brand</dt><dd>' + (result.ownsBrand ? 'yes' : 'no') + '</dd>' +
            '<dt>Top owners</dt><dd>' + owners + '</dd>' +
          '</dl>';
      } else {
        body = '<pre>' + esc(JSON.stringify(result, null, 2)) + '</pre>';
      }
      if (typeof result.tookMs === 'number') {
        body += '<div class="took">extracted in ' + (result.tookMs / 1000).toFixed(1) + 's</div>';
      }
      return body;
    }

    function summaryRow(label, result) {
      const passClass = result.pass ? 'pass' : 'fail';
      const icon = result.pass ? '✅' : '❌';
      let finding = '';
      if (result.check === 'delaware_sos') {
        finding = result.found
          ? 'File <code>#' + esc(result.fileNumber) + '</code> · <code>' + esc(result.entityName) + '</code>'
          : 'No matching entity found in Delaware Division of Corporations';
      } else if (result.check === 'ofac_sdn') {
        finding = result.pass === null ? 'Unknown: incomplete or inconsistent search evidence' : result.matchCount === 0
          ? '<code>0</code> matches on the OFAC SDN sanctions list'
          : '<code>' + esc(result.matchCount) + '</code> match(es): ' +
            (result.matches || []).map(esc).join(', ');
      } else if (result.check === 'uspto_trademark') {
        if (result.pass) {
          finding = '<code>' + esc(result.liveCount) + '</code> live USPTO marks · "Anker Innovations" found in registered owners';
        } else if (!result.liveCount) {
          finding = 'No live trademarks found for this brand';
        } else if (!result.ownsBrand) {
          finding = '<code>' + esc(result.liveCount) + '</code> live marks, but none owned by Anker Innovations';
        } else {
          finding = 'USPTO check failed';
        }
      } else {
        finding = esc(JSON.stringify(result));
      }
      return '<tr>' +
        '<td>' + esc(label) + '</td>' +
        '<td class="status ' + passClass + '">' + icon + ' ' + (result.pass === null ? 'Unknown' : result.pass ? 'Pass' : 'Fail') + '</td>' +
        '<td class="finding">' + finding + '</td>' +
      '</tr>';
    }

    function renderSummary(report) {
      const headline = document.getElementById('summaryHeadline');
      const passes = ['entity', 'sanctions', 'trademark'].filter(k => report.checks[k]?.pass).length;
      headline.textContent = report.verdict === 'PASS'
        ? 'All three demo checks returned their expected observations; this is not comprehensive merchant verification.'
        : passes + ' of 3 checks passed — review the failing items below before onboarding.';
      const body = document.getElementById('summaryBody');
      body.innerHTML =
        summaryRow('Legal entity (Delaware)', report.checks.entity) +
        summaryRow('Sanctions (OFAC SDN)',    report.checks.sanctions) +
        summaryRow('Brand ownership (USPTO)', report.checks.trademark);
    }

    function resetUI() {
      reportEl.style.display = 'none';
      for (const key of ['DE SoS', 'OFAC  ', 'USPTO ']) {
        const v = viewFor(key);
        const b = badgeFor(key);
        b.textContent = 'waiting';
        b.className = 'badge';
        frameOf(v).innerHTML = '<div class="placeholder">Connecting…</div>';
        const d = detailsOf(v);
        d.innerHTML = '';
        d.className = 'view-details hidden';
      }
    }

    btn.addEventListener('click', () => {
      btn.disabled = true;
      statusEl.textContent = 'Spinning up three Browserbase sessions in parallel…';
      resetUI();

      const ev = new EventSource('/run');
      ev.onmessage = (m) => {
        const event = JSON.parse(m.data);
        if (event.type === 'session_started') {
          const v = viewFor(event.check);
          if (v) {
            frameOf(v).innerHTML = '<iframe src="' + event.liveViewUrl +
              '" allow="clipboard-read; clipboard-write; fullscreen" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>';
            const b = badgeFor(event.check);
            b.textContent = 'live'; b.className = 'badge live';
          }
          statusEl.textContent = event.check.trim() + ' session live · ' + event.sessionId;
        } else if (event.type === 'check_completed') {
          const b = badgeFor(event.check);
          if (b) {
            b.textContent = event.result.pass === null ? 'unknown' : event.result.pass ? 'pass' : 'fail';
            b.className = 'badge done ' + (event.result.pass === null ? 'unknown' : event.result.pass ? 'pass' : 'fail');
          }
          const v = viewFor(event.check);
          if (v) {
            const d = detailsOf(v);
            d.innerHTML = renderDetails(event.result);
            d.className = 'view-details';
          }
        } else if (event.type === 'report') {
          const r = event.report;
          statusEl.textContent = 'Done in ' + r.wallClockSeconds + 's · verdict ' + r.verdict;
          verdictEl.textContent = 'Verdict: ' + r.verdict + ' · ' + r.wallClockSeconds + 's';
          verdictEl.className = 'verdict ' + r.verdict.toLowerCase();
          renderSummary(r);
          jsonEl.textContent = JSON.stringify(r, null, 2);
          reportEl.style.display = 'block';
          btn.disabled = false;
          ev.close();
        } else if (event.type === 'error') {
          statusEl.textContent = 'Error: ' + event.message;
          btn.disabled = false;
          ev.close();
        }
      };
      ev.onerror = () => {
        statusEl.textContent = 'Connection lost.';
        btn.disabled = false;
        ev.close();
      };
    });
  </script>
</body>
</html>`;

http
  .createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && req.url === "/run") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      const send = (event: KybEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };
      try {
        const report = await runKyb(send);
        send({ type: "report", report });
      } catch (err: any) {
        console.error("[server] runKyb failed:", err);
        send({ type: "error", message: err?.message ?? String(err) });
      } finally {
        res.end();
      }
      return;
    }

    res.writeHead(404);
    res.end();
  })
  .listen(PORT, () => {
    console.log(`\n  KYB demo server: http://localhost:${PORT}\n`);
  });
