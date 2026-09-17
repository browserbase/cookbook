// A "vibe-coded" task app with a planted RUNTIME bug — the kind Playwright can't
// root-cause. Clicking "Add task" (1) fires an API call that fails, and (2) hits an
// uncaught TypeError (wrong selector), so the task never renders. The UI just does
// nothing — a passing-looking page that silently fails.

// The source, kept readable so the report can show the exact buggy line.
export const SOURCE = `function addTask() {
  const value = document.getElementById('new-task').value.trim();
  fetch(API + '/v1/tasks', { method: 'POST',
    body: JSON.stringify({ title: value }) }).then(r => r.json());
  const title = document.querySelector('#task-title').value.trim();  // ← bug: id is #new-task
  renderTask(title);
}`;
export const BUG_LINE = 5;

const HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>TaskFlow</title>
<style>
 *{box-sizing:border-box} body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f5fb;color:#1a1a2e}
 .top{background:linear-gradient(135deg,#6d5efc,#c65bf6);color:#fff;padding:20px 28px}
 .top h1{margin:0;font-size:20px;font-weight:700}.top p{margin:4px 0 0;opacity:.85;font-size:13px}
 .wrap{max-width:560px;margin:32px auto;padding:0 20px}
 .card{background:#fff;border-radius:16px;box-shadow:0 6px 30px rgba(80,70,180,.10);padding:24px}
 .row{display:flex;gap:10px} input{flex:1;padding:12px 14px;border:1.5px solid #e4e4f0;border-radius:10px;font-size:15px;outline:none}
 input:focus{border-color:#6d5efc} button{background:#6d5efc;color:#fff;border:0;border-radius:10px;padding:12px 20px;font-size:15px;font-weight:600;cursor:pointer}
 ul{list-style:none;margin:20px 0 0;padding:0} li{display:flex;gap:12px;padding:14px 4px;border-bottom:1px solid #f0f0f7;font-size:15px}
 .dot{width:20px;height:20px;border:2px solid #cdcde0;border-radius:6px;flex:none} .empty{color:#9a9ab0;text-align:center;padding:24px 0;font-size:14px}
</style></head>
<body>
 <div class="top"><h1>✦ TaskFlow</h1><p>Your tasks, beautifully organized</p></div>
 <div class="wrap"><div class="card">
   <div class="row"><input id="new-task" placeholder="Add a new task…"/><button id="add-btn" data-btc-probe="add-task">Add task</button></div>
   <ul id="list"><li class="empty" id="empty">No tasks yet — add your first one above.</li></ul>
 </div></div>
 <script>
   const API = 'https://tasks-api.internal.invalid';
   const list = document.getElementById('list');
   function renderTask(title){ const e=document.getElementById('empty'); if(e)e.remove();
     const li=document.createElement('li'); const d=document.createElement('span'); d.className='dot';
     const s=document.createElement('span'); s.textContent=title; li.appendChild(d); li.appendChild(s); list.appendChild(li); }
   function addTask(){
     const value = document.getElementById('new-task').value.trim();
     fetch(API + '/v1/tasks', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ title: value }) }).then(r=>r.json());
     const title = document.querySelector('#task-title').value.trim();      // BUG: real id is #new-task -> null -> TypeError
     renderTask(title);
   }
   document.getElementById('add-btn').addEventListener('click', addTask);
   document.getElementById('new-task').addEventListener('keydown', e=>{ if(e.key==='Enter') addTask(); });
 </script>
</body></html>`;

export const BUGGY_HTML = HTML;
export const dataUrl = 'data:text/html;base64,' + Buffer.from(HTML).toString('base64');
