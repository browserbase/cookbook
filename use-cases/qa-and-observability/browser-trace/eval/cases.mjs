// A small bench of buggy apps across error classes. Each case declares the buggy
// HTML, the action to take, a UI check (what a Playwright test asserts), and the
// GROUND-TRUTH root cause + which signal reveals it. We deliberately include
// pure-logic bugs where NO runtime telemetry exists — so the eval is honest.

const shell = (title, body, script) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:#f4f5fb;color:#1a1a2e}
.top{background:linear-gradient(135deg,#6d5efc,#c65bf6);color:#fff;padding:16px 22px;font-weight:700}
.card{max-width:520px;margin:28px auto;background:#fff;border-radius:14px;box-shadow:0 6px 24px rgba(80,70,180,.1);padding:22px}
button{background:#6d5efc;color:#fff;border:0;border-radius:9px;padding:10px 16px;font-weight:600;cursor:pointer}
input{padding:10px 12px;border:1.5px solid #e4e4f0;border-radius:9px;font-size:15px;width:60%}
.out{margin-top:16px} .item{padding:10px 4px;border-bottom:1px solid #eee} .cnt{font-size:22px;font-weight:700}
.row{display:flex;gap:8px;align-items:center}</style></head>
<body><div class="top">✦ ${title}</div><div class="card">${body}</div><script>${script}</script></body></html>`;

export const CASES = [
  {
    id: 'c1', category: 'Runtime · null deref', title: 'Add task',
    body: `<div class="row"><input id="new-task" placeholder="Task"><button id="go">Add</button></div><div class="out" id="out"></div>`,
    // BUG: queries #task-title (doesn't exist) -> null.value -> TypeError
    script: `document.getElementById('go').addEventListener('click',()=>{const v=document.querySelector('#task-title').value.trim();const d=document.createElement('div');d.className='item';d.textContent=v;document.getElementById('out').appendChild(d);});`,
    check: { kind: 'appear', sel: '#out .item' },
    truth: { signal: 'exception', root: "TypeError: reads #task-title (should be #new-task)" },
  },
  {
    id: 'c2', category: 'Runtime · undefined fn', title: 'Save note',
    body: `<div class="row"><input id="note" placeholder="Note"><button id="go">Save</button></div><div class="out" id="out"></div>`,
    // BUG: calls renderNote() which is never defined -> ReferenceError
    script: `document.getElementById('go').addEventListener('click',()=>{const v=document.getElementById('note').value.trim();renderNote(v);});`,
    check: { kind: 'appear', sel: '#out .item' },
    truth: { signal: 'exception', root: 'ReferenceError: renderNote is not defined' },
  },
  {
    id: 'c3', category: 'Network · failed request', title: 'Load orders',
    body: `<button id="go">Load orders</button><div class="out" id="out"></div>`,
    // BUG: hits an API that fails; response never handled -> empty UI, no error shown
    script: `document.getElementById('go').addEventListener('click',()=>{fetch('https://orders-api.internal.invalid/v1/orders').then(r=>r.json()).then(o=>{const d=document.createElement('div');d.className='item';d.textContent=o.length+' orders';document.getElementById('out').appendChild(d);});});`,
    check: { kind: 'appear', sel: '#out .item' },
    truth: { signal: 'network', root: 'GET /v1/orders failed (request never succeeds)' },
  },
  {
    id: 'c4', category: 'Console · swallowed error', title: 'Apply coupon',
    body: `<div class="row"><input id="code" placeholder="Coupon"><button id="go">Apply</button></div><div class="out" id="out"></div>`,
    // BUG: throws inside try, caught and console.error'd, UI silently does nothing
    script: `function applyCoupon(c){ if(!c.discount) throw new Error('coupon.discount missing'); return c.discount; }
document.getElementById('go').addEventListener('click',()=>{try{const pct=applyCoupon({});const d=document.createElement('div');d.className='item';d.textContent=pct+'% off';document.getElementById('out').appendChild(d);}catch(e){console.error('apply coupon failed:', e.message);}});`,
    check: { kind: 'appear', sel: '#out .item' },
    truth: { signal: 'console', root: "caught error logged, not shown: 'coupon.discount missing'" },
  },
  {
    id: 'c5', category: 'Logic · wrong value', title: 'Cart quantity',
    body: `<div class="row"><button id="dec">−</button><span class="cnt" id="count">2</span><button id="go">+</button></div>`,
    // BUG: increment does q-1 (off-by-two). No runtime error at all.
    script: `let q=2;const el=document.getElementById('count');document.getElementById('go').addEventListener('click',()=>{q=q+1-2;el.textContent=q;});document.getElementById('dec').addEventListener('click',()=>{q=Math.max(1,q-1);el.textContent=q;});`,
    check: { kind: 'text', sel: '#count', expect: '3' },
    truth: { signal: 'none', root: 'logic bug: q+1-2 decrements — no runtime signal' },
  },
  {
    id: 'c6', category: 'Logic · no render', title: 'Add subscriber',
    body: `<div class="row"><input id="email" placeholder="Email"><button id="go">Subscribe</button></div><div class="out" id="out"></div>`,
    // BUG: reads value fine but forgets to append to the list. No runtime error.
    script: `document.getElementById('go').addEventListener('click',()=>{const v=document.getElementById('email').value.trim();console.log('would add', v);/* forgot to render */});`,
    check: { kind: 'appear', sel: '#out .item' },
    truth: { signal: 'none', root: 'logic bug: handler never appends — no runtime signal' },
  },
];

export const htmlFor = (c) => shell(c.title, c.body, c.script);
export const dataUrlFor = (c) => 'data:text/html;base64,' + Buffer.from(htmlFor(c)).toString('base64') + '#' + c.id;
