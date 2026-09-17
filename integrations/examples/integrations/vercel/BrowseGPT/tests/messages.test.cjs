const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(process.env.COOKBOOK_R165_BASELINE || path.join(__dirname, '../app/page.tsx'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function fixture(parts, overrides = {}) {
 const state = { messages: [{ id: 'answer', role: 'assistant', parts }], status: 'ready', ...overrides };
 const slots = [], effects = [], calls = []; let cursor = 0;
 const useState = initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; };
 const useRef = initial => { const i = cursor++; return slots[i] ??= { current: initial }; };
 const jsx = (type, props) => ({ type: typeof type === 'string' ? type : type.displayName || type.name || 'component', props });
 const exports = {};
 const ctx = vm.createContext({ exports, console, fetch: async () => ({ ok: true, json: async () => ({ capability: 'fixture-capability', debuggerUrl: 'https://example.invalid/debugger', expiresAt: 9999999999 }) }), require: name => {
  if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' };
  if (name === 'react') return { useState, useRef, useEffect: fn => effects.push(fn) };
  if (name === '@ai-sdk/react') return { useChat: () => ({ ...state, sendMessage: async value => { calls.push(['send', value]); if (state.simulateFailure) { state.status = 'error'; state.error = Error('SECRET_SWALLOWED_ERROR'); } }, clearError: () => { calls.push(['clearError']); state.error = undefined; }, addToolOutput: value => calls.push(['toolOutput', value]), setMessages: value => { state.messages = value; }, stop: async () => {} }) };
  if (name === 'ai') return { DefaultChatTransport: class {} };
  return new Proxy({}, { get: (_, key) => { const component = () => null; component.displayName = String(key); return component; } });
 } });
 vm.runInContext(compiled, ctx);
 const render = (flush = true) => { cursor = 0; effects.length = 0; let tree = exports.default(); if (flush) { const pending = effects.splice(0); for (const effect of pending) effect(); cursor = 0; tree = exports.default(); } return tree; };
 return { render, state, calls };
}
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...nodes(tree.props?.children)]; }
function text(tree) { if (typeof tree === 'string' || typeof tree === 'number') return String(tree); if (Array.isArray(tree)) return tree.map(text).join(' '); return tree && typeof tree === 'object' ? text(tree.props?.children) : ''; }
const answer = { type: 'text', text: 'ANSWER_MARKER' };
const tool = { type: 'tool-getPageContent', toolCallId: 'call1', state: 'output-available', input: {}, output: { content: 'TOOL_MARKER' } };
test('mixed assistant content renders every part in order', () => { const f = fixture([{ type: 'text', text: 'BEFORE_MARKER' }, tool, answer]); const rendered = text(f.render()); assert.ok(rendered.includes('BEFORE_MARKER')); assert.ok(rendered.includes('TOOL_MARKER')); assert.ok(rendered.includes('ANSWER_MARKER')); assert.ok(rendered.indexOf('BEFORE_MARKER') < rendered.indexOf('TOOL_MARKER')); assert.ok(rendered.indexOf('TOOL_MARKER') < rendered.indexOf('ANSWER_MARKER')); });
for (const parts of [[answer], [tool]]) test(`renders standalone ${parts[0].type}`, () => { const rendered = text(fixture(parts).render()); assert.ok(rendered.includes(parts[0].type === 'text' ? 'ANSWER_MARKER' : 'TOOL_MARKER')); });
test('failed tool state stays visible alongside answer without exposing raw error', () => { const rendered = text(fixture([{ ...tool, state: 'output-error', output: undefined, errorText: 'SECRET_PROVIDER_DETAIL' }, answer]).render()); assert.match(rendered, /could not complete/i); assert.ok(rendered.includes('ANSWER_MARKER')); assert.ok(!rendered.includes('SECRET_PROVIDER_DETAIL')); });
test('confirmation result does not hide answer text', () => { const rendered = text(fixture([{ type: 'tool-askForConfirmation', toolCallId: 'confirm', state: 'output-available', input: { message: 'QUESTION_MARKER' }, output: { confirmed: false } }, answer]).render()); assert.ok(rendered.includes('QUESTION_MARKER')); assert.match(rendered, /Declined/); assert.ok(rendered.includes('ANSWER_MARKER')); });
for (const interrupted of [false, true]) test(`request error offers edit recovery and retains ${interrupted ? 'partial answer' : 'request'}`, () => {
 const messages = [{ id: 'request', role: 'user', parts: [{ type: 'text', text: 'REQUEST_MARKER' }] }, ...(interrupted ? [{ id: 'partial', role: 'assistant', parts: [answer] }] : [])];
 const f = fixture([], { messages, status: 'error', error: Error('SECRET_REQUEST_DETAIL') }); const tree = f.render(); assert.ok(nodes(tree).some(n => n.props?.role === 'alert')); assert.ok(text(tree).includes('REQUEST_MARKER')); if (interrupted) assert.ok(text(tree).includes('ANSWER_MARKER')); assert.ok(!text(tree).includes('SECRET_REQUEST_DETAIL'));
 const recover = nodes(tree).find(n => n.type === 'button' && /edit/i.test(text(n))); assert.ok(recover); recover.props.onClick(); const next = f.render(); const input = nodes(next).find(n => n.type === 'input'); assert.equal(input.props.value, 'REQUEST_MARKER'); assert.ok(f.calls.some(x => x[0] === 'clearError')); assert.equal(f.calls.filter(x => x[0] === 'send').length, 0);
});

test('SDK failure that resolves sendMessage preserves submitted draft and exposes recovery', async () => {
 const f = fixture([], { messages: [], simulateFailure: true }); let tree = f.render(); nodes(tree).find(n => n.type === 'input').props.onChange({ target: { value: 'KEEP_MY_REQUEST' } }); tree = f.render(); nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); await new Promise(resolve => setImmediate(resolve)); tree = f.render(); assert.equal(nodes(tree).find(n => n.type === 'input').props.value, 'KEEP_MY_REQUEST'); assert.ok(nodes(tree).some(n => n.props?.role === 'alert')); assert.equal(f.calls.filter(x => x[0] === 'send').length, 1);
});
test('recovery cannot run while streaming', () => { const f = fixture([answer], { status: 'streaming', error: Error('fixture') }); const tree = f.render(); const button = nodes(tree).find(n => n.type === 'button' && /edit/i.test(text(n))); assert.equal(button.props.disabled, true); button.props.onClick(); assert.equal(f.calls.length, 0); });
test('dynamic tool and pending confirmation keep surrounding text', () => { const tree = fixture([{ ...tool, type: 'dynamic-tool', toolName: 'getPageContent' }, { type: 'tool-askForConfirmation', state: 'input-available', toolCallId: 'ask', input: { message: 'QUESTION_MARKER' } }, answer]).render(); assert.ok(text(tree).includes('TOOL_MARKER')); assert.ok(text(tree).includes('QUESTION_MARKER')); assert.ok(text(tree).includes('ANSWER_MARKER')); const confirm = nodes(tree).find(n => n.type === 'Confirmation'); assert.ok(confirm); assert.equal(confirm.props.busy, true); });
