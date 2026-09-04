import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  claimJob,
  portalSupportsPaymentInstrument,
  replaceTemplateVars,
  requireSuccessfulStepAction,
  validateJobData,
} from "../src/job-contracts.mjs";

const baseRequest = {
  job_id: "job-1",
  type: "bill_pay",
  username: "person@example.test",
  password: "pa$$word-$&-$`-$'",
  portal: "att",
  payment_instrument: {
    type: "ach",
    account_number: "000123456789",
    routing_number: "021000021",
  },
  payment_amount_in_cents: 12345,
};

function portal(overrides = {}) {
  return {
    id: "att",
    name: "Synthetic portal",
    loginUrl: "https://example.test/login",
    billPullSteps: [],
    billPaySteps: [],
    ...overrides,
  };
}

test("equivalent concurrent claims keep the original execution state", async () => {
  const jobs = new Map();
  const first = { request: baseRequest, portal: portal(), marker: "original" };
  const reordered = {
    request: Object.fromEntries(Object.entries(baseRequest).reverse()),
    portal: portal(),
    marker: "retry",
  };
  const [left, right] = await Promise.all([
    Promise.resolve().then(() => claimJob(jobs, first)),
    Promise.resolve().then(() => claimJob(jobs, reordered)),
  ]);

  assert.equal(Number(left.created) + Number(right.created), 1);
  assert.equal(jobs.size, 1);
  assert.equal(left.state, right.state);
  assert.equal(left.state.marker, "original");
});

test("conflicting retries are rejected without replacing the first job", () => {
  const jobs = new Map();
  const first = { request: baseRequest, portal: portal() };
  claimJob(jobs, first);
  assert.throws(
    () =>
      claimJob(jobs, {
        request: { ...baseRequest, payment_amount_in_cents: 1 },
        portal: portal(),
      }),
    /different request/,
  );
  assert.equal(jobs.get(baseRequest.job_id), first);
});

test("template values are inserted literally and missing values fail closed", () => {
  const rendered = replaceTemplateVars(
    "{{username}}|{{password}}|{{account_number}}|{{routing_number}}|{{payment_amount}}|{{mfa_code}}",
    baseRequest,
    "0$&123",
  );
  assert.equal(
    rendered,
    "person@example.test|pa$$word-$&-$`-$'|000123456789|021000021|123.45|0$&123",
  );
  assert.throws(
    () => replaceTemplateVars("{{unknown_value}}", baseRequest),
    /Missing template value/,
  );
});

test("payment instruments are rejected unless both identifiers reach a step", () => {
  assert.equal(portalSupportsPaymentInstrument(baseRequest, portal()), false);
  assert.equal(
    portalSupportsPaymentInstrument(
      baseRequest,
      portal({
        billPaySteps: [
          {
            action: "act",
            description: "select source",
            instruction: "Use {{routing_number}} / {{account_number}}",
          },
        ],
      }),
    ),
    true,
  );
});

test("bill-pay results satisfy the declared shape and requested amount", () => {
  const valid = {
    transaction_id: "confirmation-123",
    payment_date: "2026-09-07 12:00:00",
    amount_paid: 123.45,
  };
  assert.deepEqual(validateJobData(baseRequest, valid), valid);
  assert.throws(
    () => validateJobData(baseRequest, { ...valid, amount_paid: 0.01 }),
    /does not match requested amount/,
  );
  assert.throws(
    () => validateJobData(baseRequest, { ...valid, payment_date: "not-a-date" }),
    /date must use YYYY-MM-DD HH:mm:ss/,
  );
  assert.throws(
    () => validateJobData(baseRequest, { ...valid, transaction_id: undefined }),
  );
  assert.throws(
    () => validateJobData(baseRequest, { ...valid, payment_date: "2026-02-30 12:00:00" }),
    /real UTC date/,
  );
});

test("an unsuccessful automation action prevents a successful job result", () => {
  assert.throws(
    () =>
      requireSuccessfulStepAction(
        { data: { success: false, message: "button was not found" } },
        "Submit payment",
      ),
    /Action failed: Submit payment: button was not found/,
  );
});

test("the T-Mobile flow requests SMS before observing the code-entry state", async () => {
  const definition = JSON.parse(
    await readFile(new URL("../portals/tmobile.json", import.meta.url), "utf8"),
  );
  const selectSms = definition.billPullSteps.findIndex((step) =>
    step.description.includes("select SMS"),
  );
  const observeCode = definition.billPullSteps.findIndex(
    (step) => step.action === "observe",
  );
  const enterCode = definition.billPullSteps.findIndex((step) =>
    step.instruction?.includes("{{mfa_code}}"),
  );
  assert.ok(selectSms >= 0 && selectSms < observeCode);
  assert.ok(observeCode < enterCode);
  assert.doesNotMatch(
    JSON.stringify(definition.billPullSteps.slice(0, selectSms)),
    /mfa_code/,
  );
});
