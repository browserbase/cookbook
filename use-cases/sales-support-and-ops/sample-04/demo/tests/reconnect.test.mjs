import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, stripTypeScriptTypes } from 'node:module';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const require = createRequire(import.meta.url);
const express = require(process.env.EXPRESS_MODULE_PATH || 'express');
function loadStore() {
  const source = readFileSync(new URL('src/run-state.ts', root), 'utf8')
    .replace(/^import [\s\S]*?;\n/gm, '').replace(/export /g, '');
  const context = vm.createContext({ randomUUID, structuredClone });
  vm.runInContext(stripTypeScriptTypes(source) + '\nglobalThis.Store = RunStateStore;', context);
  return context.Store;
}
async function fixture() {
  const app = express();
  let server;
  const listen = app.listen.bind(app);
  app.listen = () => { server = listen(0, '127.0.0.1'); return server; };
  const pending = [];
  class Automation {
    constructor(status) { this.status = status; }
    run() { return new Promise((resolve, reject) => pending.push({resolve, reject, status: this.status})); }
  }
  const source = readFileSync(new URL('src/server.ts', root), 'utf8')
    .replace(/^import [\s\S]*?;\n/gm, '').replace('fileURLToPath(import.meta.url)', JSON.stringify(fileURLToPath(new URL('src/server.ts', root))));
  const factory = Object.assign(() => app, {json: express.json, static: express.static});
  const context = vm.createContext({RunStateStore: loadStore(), express: factory, WorkAppTestAutomation: Automation,
    dirname, path: {join}, config: {server: {port: 0}}, validateConfig() {}, process: {on() {}}, console});
  vm.runInContext(stripTypeScriptTypes(source), context);
  if (!server.listening) await new Promise(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return { pending, origin, async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
async function snapshot(origin, endpoint='/api/status') {
  const abort = new AbortController();
  const response = await fetch(origin + endpoint, {signal: abort.signal});
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  let text = '';
  try {
    while (!text.includes('\n\n')) {
      const {value, done} = await reader.read();
      assert.equal(done, false);
      text += new TextDecoder().decode(value);
    }
    return JSON.parse(text.split('\n\n')[0].slice(6));
  } finally { abort.abort(); await reader.cancel().catch(() => {}); }
}
const preview = status => ({testName: 'Synthetic run', status, duration: 1,
  metrics: {pageLoadTime: 0, formFillTime: 0, totalLoginFlowTime: 1}, screenshot: ''});
async function settled(origin) {
  for (let count=0; count<100; count++) {
    const value = await (await fetch(origin + '/api/run')).json();
    if (!value.isRunning) return value;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail('run did not settle');
}
for (const outcome of ['PASSED', 'FAILED']) test(`real HTTP reconnect recovers ${outcome} result after disconnected completion`, async () => {
  const f = await fixture();
  try {
    assert.equal((await snapshot(f.origin)).stage, 'idle');
    const started = await (await fetch(f.origin + '/api/start', {method:'POST'})).json();
    const running = await snapshot(f.origin);
    assert.equal(running.runId, started.runId);
    assert.equal(running.isRunning, true);
    assert.equal((await fetch(f.origin + '/api/start', {method:'POST'})).status, 409);
    const result = {success:true, taskPreview:preview(outcome), timestamp:new Date().toISOString()};
    f.pending[0].status({stage:'completed', message:'Synthetic terminal', timestamp:result.timestamp, metadata:{result}});
    assert.equal((await snapshot(f.origin)).isRunning, true, 'terminal callback does not bypass cleanup');
    f.pending[0].resolve(result);
    await settled(f.origin);
    const recovered = await snapshot(f.origin);
    assert.equal(recovered.stage, 'completed');
    assert.equal(recovered.isRunning, false);
    assert.equal(recovered.runId, started.runId);
    assert.equal(recovered.metadata.result.taskPreview.status, outcome);
    assert.deepEqual(recovered, await (await fetch(f.origin + '/api/run')).json());
    assert.equal(f.pending.length, 1, 'reconnect does not create another workflow');
  } finally { await f.close(); }
});
test('execution rejection remains recoverable as error without leaking thrown text', async () => {
  const f = await fixture();
  try {
    await fetch(f.origin + '/api/start', {method:'POST'});
    f.pending[0].reject(new Error('PRIVATE_SYNTHETIC_ERROR'));
    await settled(f.origin);
    const recovered = await snapshot(f.origin);
    assert.equal(recovered.stage, 'error'); assert.equal(recovered.isRunning, false);
    assert.ok(!JSON.stringify(recovered).includes('PRIVATE_SYNTHETIC_ERROR'));
  } finally { await f.close(); }
});
test('actual UI reconciles running, failed test, idle and duplicate snapshots', () => {
  const html = readFileSync(new URL('public/index.html', root), 'utf8');
  const start = html.indexOf('    function updateStatusUI(state) {');
  const source = html.slice(start, html.indexOf('    function updateMetricsUI(metrics)', start));
  const button = {disabled:true}; const results=[]; const logs=[];
  const scope = vm.createContext({lastStatusKey:null,sessionUrl:null,document:{getElementById:()=>button},
    addStatusUpdate:(...args)=>logs.push(args),displayTestResults:value=>results.push(value),loadBrowserIframe() {}});
  vm.runInContext(source, scope);
  const state = {runId:'synthetic',revision:1,isRunning:true,stage:'initializing',message:'Running'};
  scope.updateStatusUI(state); assert.equal(button.disabled,true);
  state.revision=2;state.stage='completed';state.isRunning=false;state.metadata={result:{taskPreview:preview('FAILED')}};
  scope.updateStatusUI(state); assert.equal(button.disabled,false);assert.equal(results[0].status,'FAILED');
  assert.deepEqual(logs.at(-1).slice(1),[false,true]);
  button.disabled=true; scope.updateStatusUI(state); assert.equal(results.length,1); assert.equal(button.disabled,false);
  scope.updateStatusUI({runId:null,revision:0,isRunning:false,stage:'idle',message:'Waiting'});
  assert.equal(button.disabled,false);
});
