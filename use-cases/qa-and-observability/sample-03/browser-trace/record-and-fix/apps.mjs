// The "AppBuilder-built" sample app, in two versions: buggy and fixed.
// Loaded into the Browserbase session as data: URLs (no hosting needed).
// The bug: clicking "Add task" does nothing (handler never updates the list).

const shell = (title, script) => `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    background:#f4f5fb;color:#1a1a2e;min-height:100vh}
  .top{background:linear-gradient(135deg,#6d5efc,#c65bf6);color:#fff;padding:20px 28px}
  .top h1{margin:0;font-size:20px;font-weight:700;letter-spacing:-.3px}
  .top p{margin:4px 0 0;opacity:.85;font-size:13px}
  .wrap{max-width:560px;margin:32px auto;padding:0 20px}
  .card{background:#fff;border-radius:16px;box-shadow:0 6px 30px rgba(80,70,180,.10);padding:24px}
  .row{display:flex;gap:10px}
  input{flex:1;padding:12px 14px;border:1.5px solid #e4e4f0;border-radius:10px;font-size:15px;outline:none}
  input:focus{border-color:#6d5efc}
  button{background:#6d5efc;color:#fff;border:0;border-radius:10px;padding:12px 20px;font-size:15px;
    font-weight:600;cursor:pointer;transition:transform .05s}
  button:active{transform:scale(.97)}
  ul{list-style:none;margin:20px 0 0;padding:0}
  li{display:flex;align-items:center;gap:12px;padding:14px 4px;border-bottom:1px solid #f0f0f7;font-size:15px}
  li:last-child{border-bottom:0}
  .dot{width:20px;height:20px;border:2px solid #cdcde0;border-radius:6px;flex:none}
  .empty{color:#9a9ab0;text-align:center;padding:24px 0;font-size:14px}
</style></head>
<body>
  <div class="top"><h1>✦ TaskFlow</h1><p>Your tasks, beautifully organized</p></div>
  <div class="wrap"><div class="card">
    <div class="row">
      <input id="new-task" placeholder="Add a new task…" />
      <button id="add-btn">Add task</button>
    </div>
    <ul id="list"><li class="empty" id="empty">No tasks yet — add your first one above.</li></ul>
  </div></div>
  <script>${script}</script>
</body></html>`;

// BUGGY: the click handler reads the input but never appends to the list.
const buggyScript = `
  const btn = document.getElementById('add-btn');
  const input = document.getElementById('new-task');
  btn.addEventListener('click', () => {
    const val = input.value.trim();
    if (!val) return;
    // BUG: forgot to render the task into the list
    console.log('would add:', val);
    input.value = '';
  });
`;

// FIXED: appends a list item and clears the empty state.
const fixedScript = `
  const btn = document.getElementById('add-btn');
  const input = document.getElementById('new-task');
  const list = document.getElementById('list');
  function addTask(val){
    const empty = document.getElementById('empty');
    if (empty) empty.remove();
    const li = document.createElement('li');
    const dot = document.createElement('span'); dot.className='dot';
    const span = document.createElement('span'); span.textContent = val;
    li.appendChild(dot); li.appendChild(span); list.appendChild(li);
  }
  btn.addEventListener('click', () => {
    const val = input.value.trim();
    if (!val) return;
    addTask(val);
    input.value = '';
  });
  input.addEventListener('keydown', e => { if (e.key==='Enter') btn.click(); });
`;

export const BUGGY_HTML = shell('TaskFlow', buggyScript);
export const FIXED_HTML = shell('TaskFlow', fixedScript);
export const dataUrl = (html) => 'data:text/html;base64,' + Buffer.from(html).toString('base64');
