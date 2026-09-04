const assert = require('node:assert/strict');
const { test } = require('node:test');

test('resolved operations hours drive both the model and report label', async t => {
  const { calculateCosts } = await import('../dist/cost.js');
  const { generateReportHtml } = await import('../dist/report.js');
  const zero = calculateCosts({ sessionsPerDay: 100, avgSessionMinutes: 5, opsHoursPerMonth: 0 });
  assert.equal(zero.selfHosted.ops, 0);
  const previous = process.env.OPS_HOURS;
  t.after(() => { if (previous === undefined) delete process.env.OPS_HOURS; else process.env.OPS_HOURS = previous; });
  process.env.OPS_HOURS = '0';
  const html = generateReportHtml([{ competitor: 'browserbase', scenario: 'synthetic', site: 'https://example.invalid', runIndex: 0, steps: { goto: 100 }, total: 100 }]);
  assert.match(html, /Ops engineering \(0h\/mo\).*?\$0\/mo/);
  assert.equal(html.includes('Above it, self-hosting compute costs exceed'), false);
});

test('compute crossover agrees with modeled inequalities on both sides', async () => {
  const { calculateCosts } = await import('../dist/cost.js');
  const base = { sessionsPerDay: 100, avgSessionMinutes: 5 };
  const threshold = calculateCosts(base).breakevenComputeOnly;
  const below = calculateCosts({ ...base, sessionsPerDay: threshold / 2 });
  const above = calculateCosts({ ...base, sessionsPerDay: threshold * 2 });
  assert.ok(below.browserbase.total < below.selfHosted.compute);
  assert.ok(above.browserbase.total > above.selfHosted.compute);
  assert.throws(() => calculateCosts({ ...base, opsHoursPerMonth: -1 }), /operations hours/i);
});
