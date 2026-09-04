const assert = require('node:assert/strict');
const { test } = require('node:test');

test('all-observation medians are labeled without claiming a fast subset or initialization cause', async () => {
  const { generateReportHtml } = await import('../dist/report.js');
  const nav = { dns: 0, tcp: 0, tls: 0, ttfb: 0, download: 0, domContentLoaded: 0 };
  const rows = [100, 1000, 1000].map((goto, runIndex) => ({ competitor: 'browserbase', scenario: 'synthetic', site: 'https://example.invalid', runIndex, steps: { init: 0, goto }, total: goto, metadata: { navigation: nav } }));
  rows.push({ ...rows[0], competitor: 'local-chromium' });
  const html = generateReportHtml(rows);
  const label = 'Browserbase (successful observations with navigation timing)';
  assert.ok(html.includes(label));
  assert.ok(html.slice(html.indexOf(label), html.indexOf(label) + 1000).includes('1.000s'));
  assert.ok(html.includes('all successful observations'));
  assert.equal(html.includes('Most overhead is in session init'), false);
  assert.equal(html.includes('are near-parity with self-hosted'), false);
  assert.equal(html.includes('Browserbase fast path'), false);
  assert.equal(html.includes('Browserbase (fast path,'), false);
});
