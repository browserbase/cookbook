const assert = require('node:assert/strict');
const vm = require('node:vm');
const { test } = require('node:test');

test('scenario selector uses independently calculated reports', async () => {
  const { generateReportHtml } = await import('../dist/report.js');
  const base = { competitor: 'local-chromium', site: 'https://example.invalid', runIndex: 0, metadata: { host: 'local-machine' } };
  const navigation = { ...base, scenario: 'navigation', steps: { goto: 100 }, total: 100 };
  const search = { ...base, scenario: 'search', steps: { goto: 100, search: 9900 }, total: 10000 };
  const html = generateReportHtml([navigation, search]);
  const match = html.match(/const scenarioReports = (.*);/);
  assert.ok(match, 'multi-scenario report must offer a selector');
  const reports = JSON.parse(match[1]);
  assert.equal(reports.length, 2);
  for (const [index, row] of [navigation, search].entries()) {
    const separate = generateReportHtml([row]);
    const chart = content => JSON.parse(content.match(/const allWaterfallData = (.*);/)[1]);
    assert.deepEqual(chart(reports[index]), chart(separate));
    assert.ok(reports[index].includes(`Scenario: ${row.scenario}`));
  }
  let onChange;
  const select = { value: '0', addEventListener(event, listener) { onChange = listener; } };
  const frame = {};
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, { document: { getElementById(id) { return id === 'scenario-select' ? select : frame; } } });
  assert.equal(frame.srcdoc, reports[0]);
  select.value = '1'; onChange();
  assert.equal(frame.srcdoc, reports[1]);
});
