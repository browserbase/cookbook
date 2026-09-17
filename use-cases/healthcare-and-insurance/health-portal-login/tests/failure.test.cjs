const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const { execFileSync } = require('node:child_process');
const test = require('node:test');

const directory = path.resolve(__dirname, '..');

test('failure preserves its cause without capturing an authenticated page', async () => {
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(directory, 'main.ts'), 'utf8'));
  const context = { console: { error() {} }, process: { env: {} } };
  vm.runInNewContext(source.slice(source.lastIndexOf('export async function main')).replace('export ', ''), context);
  const failure = new Error('synthetic navigation failure');
  let screenshots = 0;
  await assert.rejects(context.main({
    page: {
      async goto() { throw failure; },
      async screenshot() { screenshots++; throw new Error('capture failed'); },
    },
    context: {},
    stagehand: {},
  }), error => error === failure);
  assert.equal(screenshots, 0);
});

test('historical capture path is ignored and no capture is tracked', () => {
  const capture = 'error-screenshot.png';
  execFileSync('git', ['check-ignore', '--no-index', '--', capture], { cwd: directory });
  assert.equal(execFileSync('git', ['ls-files', '--', capture], { cwd: directory, encoding: 'utf8' }), '');
});

function loadMain(environment = {}) {
  const source = stripTypeScriptTypes(fs.readFileSync(path.join(directory, 'main.ts'), 'utf8'));
  const context = {
    console: { error() {}, log() {} },
    process: { env: environment },
  };
  vm.runInNewContext(source.slice(source.lastIndexOf('export async function main')).replace('export ', ''), context);
  return context.main;
}

test('unsuccessful login action fails before checking an authenticated landmark', async () => {
  const main = loadMain({ HEALTH_PORTAL_USERNAME: 'fixture-user', HEALTH_PORTAL_PASSWORD: 'fixture-password' });
  let selectorChecks = 0;
  await assert.rejects(main({
    page: {
      async goto() {},
      async waitForSelector() { selectorChecks++; },
    },
    context: {},
    stagehand: {
      async act() { return { data: { success: false, message: 'credentials rejected' } }; },
    },
  }), /login action was unsuccessful: credentials rejected/);
  assert.equal(selectorChecks, 1, 'only the initial email-field check should run');
});

test('a generic heading cannot satisfy the authenticated postcondition', async () => {
  const main = loadMain();
  const selectors = [];
  await assert.rejects(main({
    page: {
      async goto() {},
      async waitForSelector(selector) {
        selectors.push(selector);
        if (selector !== 'input[autocomplete="email"]') throw new Error('authenticated landmark absent');
      },
    },
    context: {},
    stagehand: { async act() { return { data: { success: true } }; } },
  }), /authenticated landmark absent/);
  assert.equal(selectors.some(selector => selector.includes('h1.MuiBox-root')), false);
  assert.match(selectors.at(-1), /logout|Log out|Sign out/);
});
