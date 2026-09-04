// Injected into every page/frame of the recording session (via addInitScript).
// Captures human interactions as SEMANTIC steps (not raw x/y) and buffers them in
// window.__rr_events (mirrored to localStorage so they survive same-origin
// navigations). The Node side polls + drains this buffer via page.evaluate.
// (We avoid page.exposeBinding because it does not wire up over Browserbase CDP.)
(() => {
  if (window.__rr_installed) return;
  window.__rr_installed = true;
  const KEY = '__rr_buf_v2';
  const LEGACY_KEY = '__rr_buf';
  const REALM = crypto.randomUUID();
  function sensitiveField(el) {
    const g = name => (el?.getAttribute?.(name) || "").toLowerCase();
    return g("type") === "password" || /(?:current-password|new-password|one-time-code|cc-number|cc-csc)/.test(g("autocomplete")) ||
      el?.hasAttribute?.("data-private") || el?.hasAttribute?.("data-redact") ||
      /password|passcode|secret|token|api.?key/.test(g("name") + " " + g("id"));
  }

  function secretSelector(el) {
    const parts = [];
    for (let node = el; node?.nodeType === 1; node = node.parentElement) {
      let nth = 1;
      for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        if (sibling.tagName === node.tagName) nth++;
      }
      parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${nth})`);
    }
    return parts.join(" > ");
  }

  function secretEvent(el, type) {
    return { type, secret: true, name: "Sensitive field", value: null,
      role: "input", el: { tag: "input", attrs: { type: "password" }, data: {}, html: "[REDACTED]" },
      selectors: [[secretSelector(el)]], url: location.href, ts: Date.now() };
  }


  // Keep stable event identities across same-origin navigations. Draining updates
  // storage and memory together, so an acknowledged event cannot be restored.
  let stored = (() => {
    try {
      const current = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (current && Array.isArray(current.events)) return current;
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '[]');
      return { session: crypto.randomUUID(), next: 0, events: Array.isArray(legacy) ? legacy : [] };
    } catch { return { session: crypto.randomUUID(), next: 0, events: [] }; }
  })();
  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(stored));
      localStorage.removeItem(LEGACY_KEY);
    } catch (_) {}
  };
  window.__rr_events = Array.isArray(window.__rr_events) ? window.__rr_events : stored.events;

  // Older buffers may contain values captured before masking was introduced.
  window.__rr_events = (Array.isArray(window.__rr_events) ? window.__rr_events : []).map(ev => {
    const attrs = ev?.el?.attrs || {};
    const sensitive = ev?.secret || String(attrs.type || "").toLowerCase() === "password" ||
      /password|passcode|secret|token|api.?key/i.test(String(attrs.name || ""));
    return sensitive ? { type: "redacted", secret: true, name: "Sensitive field", value: null,
      reason: "Sensitive buffered event removed; re-record for replay." } : ev;
  });
  stored.events = window.__rr_events.map((ev) => ({
    ...ev,
    id: ev.id || `${stored.session}:${REALM}:${++stored.next}`,
  }));
  window.__rr_events = stored.events;
  persist();

  window.__rr_drain = () => {
    const drained = window.__rr_events;
    window.__rr_events = [];
    stored.events = window.__rr_events;
    persist();
    return drained;
  };

  const send = (ev) => {
    const identified = { ...ev, id: `${stored.session}:${REALM}:${++stored.next}` };
    window.__rr_events.push(identified);
    stored.events = window.__rr_events;
    persist();
  };
  const now = () => Date.now();
  const esc = (s) => { try { return CSS.escape(s); } catch { return s; } };

  function cssPath(el) {
    if (!(el instanceof Element)) return '';
    const parts = [];
    while (el && el.nodeType === 1 && parts.length < 6) {
      if (el.id) { parts.unshift('#' + esc(el.id)); break; }
      let nth = 1, sib = el;
      while ((sib = sib.previousElementSibling)) if (sib.nodeName === el.nodeName) nth++;
      parts.unshift(el.nodeName.toLowerCase() + ':nth-of-type(' + nth + ')');
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  function xPath(el) {
    if (el.id) return '//*[@id="' + el.id + '"]';
    const parts = [];
    while (el && el.nodeType === 1) {
      let i = 1, sib = el;
      while ((sib = sib.previousElementSibling)) if (sib.nodeName === el.nodeName) i++;
      parts.unshift(el.nodeName.toLowerCase() + '[' + i + ']');
      el = el.parentElement;
    }
    return '/' + parts.join('/');
  }

  function accName(el) {
    const g = (a) => (el.getAttribute && el.getAttribute(a)) || '';
    return (g('aria-label') || g('placeholder') || g('name') || g('title') || '').trim();
  }

  // The INTENT signal: the human-meaningful name of what was acted on, recovered
  // ungated (not limited to certain tags) so an autocomplete suggestion ("New
  // York") is captured even when its only selector is a dynamic id. Priority:
  // explicit aria > labelledby > placeholder/title/alt > value > visible text.
  function nameOf(el) {
    const g = (a) => (el.getAttribute && el.getAttribute(a)) || '';
    let lbl = '';
    const lb = g('aria-labelledby');
    if (lb) lbl = lb.split(/\s+/).map((id) => (document.getElementById(id) || {}).innerText || '').join(' ').trim();
    const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
    const cand = g('aria-label') || lbl || g('placeholder') || g('title') || g('alt')
      || (el.tagName === 'INPUT' ? el.value : '') || text;
    return (cand || '').slice(0, 120);
  }
  function roleOf(el) {
    return ((el.getAttribute && el.getAttribute('role')) || el.tagName || '').toLowerCase();
  }

  // Element-level STATE at the moment of the action — the "exact probe" detail a
  // fixer needs: interactive state, data-* anchors (map to code), visibility, box,
  // and a trimmed outerHTML. Additive; consumers that don't need it can ignore `el`.
  function stateOf(el) {
    const g = (a) => (el.getAttribute && el.getAttribute(a));
    const attrs = {};
    ['disabled', 'aria-disabled', 'aria-checked', 'aria-expanded', 'aria-invalid',
     'aria-selected', 'aria-hidden', 'type', 'href', 'checked', 'required', 'name'].forEach((a) => {
      if (el.hasAttribute && el.hasAttribute(a)) attrs[a] = g(a);
    });
    if ('value' in el && el.value != null && el.value !== '') attrs.value = String(el.value).slice(0, 80);
    const data = {};
    if (el.dataset) for (const k in el.dataset) data[k] = String(el.dataset[k]).slice(0, 60);
    let visible = true;
    try { const cs = getComputedStyle(el); visible = cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0'; } catch (_) {}
    const r = (el.getBoundingClientRect && el.getBoundingClientRect()) || {};
    return {
      tag: (el.tagName || '').toLowerCase(),
      attrs, data, visible,
      rect: { x: Math.round(r.x || 0), y: Math.round(r.y || 0), w: Math.round(r.width || 0), h: Math.round(r.height || 0) },
      html: (el.outerHTML || '').replace(/\s+/g, ' ').slice(0, 320),
    };
  }

  // Chrome DevTools Recorder format: selectors is an array of selector-groups,
  // tried in priority order during replay. This list IS the healing.
  function selectorsFor(el) {
    const out = [];
    if (el.id) out.push('#' + esc(el.id));
    const an = accName(el);
    if (an) out.push('aria/' + an.slice(0, 80));
    const txt = (el.innerText || el.textContent || '').trim();
    if (txt && txt.length <= 60 && ['BUTTON', 'A', 'SUMMARY', 'LABEL', 'SPAN'].includes(el.tagName)) {
      out.push('text/' + txt);
    }
    out.push(cssPath(el));
    out.push('xpath/' + xPath(el));
    return out.filter(Boolean).map((s) => [s]);
  }

  document.addEventListener('click', (e) => {
    const el = e.target;
    if (!el || el.nodeType !== 1) return;
    if (sensitiveField(el)) { send(secretEvent(el, 'click')); return; }
    send({ type: 'click', name: nameOf(el), role: roleOf(el), el: stateOf(el), selectors: selectorsFor(el), url: location.href, ts: now() });
  }, true);

  // 'change' fires on commit/blur -> captures the final field value, not keystrokes.
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (!el || el.nodeType !== 1) return;
    if (sensitiveField(el)) { send(secretEvent(el, 'change')); return; }
    const value = ('value' in el) ? el.value : '';
    send({ type: 'change', name: nameOf(el), role: roleOf(el), el: stateOf(el), selectors: selectorsFor(el), value, url: location.href, ts: now() });
  }, true);

  document.addEventListener('keydown', (e) => {
    if (['Enter', 'Tab', 'Escape'].includes(e.key)) {
      send({ type: 'keyDown', key: e.key, url: location.href, ts: now() });
    }
  }, true);

  let st;
  window.addEventListener('scroll', () => {
    clearTimeout(st);
    st = setTimeout(() => send({ type: 'scroll', x: window.scrollX, y: window.scrollY, url: location.href, ts: now() }), 400);
  }, true);
})();
