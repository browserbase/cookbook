// recorder.js — injected into every document via Page.addScriptToEvaluateOnNewDocument.
//
// Listens for user interactions and emits structured [REC] events to console,
// which the browser-trace firehose captures via Runtime.consoleAPICalled.
//
// IIFE + install guard so re-injection on subdocuments / re-attaches is a no-op.

(() => {
  if (window.__bbRecorderInstalled) return;
  window.__bbRecorderInstalled = true;

  const REC_PREFIX = "[REC]";
  const inputDebounceMs = 250;
  const recordedInputs = new WeakMap(); // element → { value, timer }
  let opIndex = 0;
  let lastUrl = location.href;

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

  function emit(op) {
    try {
      const payload = {
        op_index: opIndex++,
        ts: new Date().toISOString(),
        url: location.href,
        frame: window.top === window ? null : location.href,
        ...op,
      };
      // Single line, parseable. Use the REC prefix so the transform can grep.
      console.log(REC_PREFIX + JSON.stringify(payload));
    } catch (e) {
      // Never break the host page.
      try {
        console.warn("[REC-ERR]", String(e));
      } catch {}
    }
  }

  // ── Selector candidate ranking ────────────────────────────────────

  function isStableId(id) {
    if (!id) return false;
    // Skip auto-generated ids: React (:r0:), Next.js (__next-…), Emotion (e-…1234)
    if (/^:r[0-9a-z]+:?$/i.test(id)) return false;
    if (/^__next/i.test(id)) return false;
    if (/-[a-f0-9]{6,}$/i.test(id)) return false;
    return true;
  }

  function escapeAttr(s) {
    return String(s).replace(/(["\\])/g, "\\$1");
  }

  function pickSelectors(el) {
    const out = [];
    if (!el || el.nodeType !== 1) return out;

    // 1. data-testid / data-test
    for (const attr of ["data-testid", "data-test", "data-cy", "data-qa"]) {
      const v = el.getAttribute && el.getAttribute(attr);
      if (v) out.push({ kind: "css", value: `[${attr}="${escapeAttr(v)}"]` });
    }

    // 2. Stable id
    if (isStableId(el.id)) {
      out.push({ kind: "css", value: `#${CSS.escape(el.id)}` });
    }

    // 3. name attribute (form inputs)
    const name = el.getAttribute && el.getAttribute("name");
    if (
      name &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT")
    ) {
      out.push({
        kind: "css",
        value: `${el.tagName.toLowerCase()}[name="${escapeAttr(name)}"]`,
      });
    }

    // 4. Role + accessible name (Playwright-style)
    const role = el.getAttribute("role") || implicitRole(el);
    const accName = accessibleName(el);
    if (role && accName) {
      out.push({ kind: "role", role, name: accName });
      // Also XPath fallback
      out.push({ kind: "xpath", value: roleXpath(el, role, accName) });
    }

    // 5. Unique CSS path with stable classes only
    const cssPath = uniqueCssPath(el);
    if (cssPath) out.push({ kind: "css", value: cssPath });

    // 6. Text-normalized XPath
    const text = (el.textContent || "").trim();
    if (text && text.length < 80) {
      out.push({
        kind: "xpath",
        value: `//${el.tagName.toLowerCase()}[normalize-space(.)=${xpathLit(text)}]`,
      });
    }

    return out;
  }

  function implicitRole(el) {
    const t = el.tagName;
    if (t === "BUTTON") return "button";
    if (t === "A" && el.hasAttribute("href")) return "link";
    if (t === "INPUT") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      if (type === "submit" || type === "button") return "button";
      return "textbox";
    }
    if (t === "TEXTAREA") return "textbox";
    if (t === "SELECT") return "combobox";
    return null;
  }

  function accessibleName(el) {
    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) return ariaLabel.trim();

    const labelledby = el.getAttribute("aria-labelledby");
    if (labelledby) {
      const labels = labelledby
        .split(/\s+/)
        .map((id) => {
          const lbl = document.getElementById(id);
          return lbl ? lbl.textContent.trim() : "";
        })
        .filter(Boolean);
      if (labels.length) return labels.join(" ");
    }

    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return (lbl.textContent || "").trim();
    }

    // Wrapping <label>
    const wrappingLabel = el.closest && el.closest("label");
    if (wrappingLabel) {
      // Strip the input's own value out
      const clone = wrappingLabel.cloneNode(true);
      clone
        .querySelectorAll("input, select, textarea")
        .forEach((n) => n.remove());
      const t = clone.textContent.trim();
      if (t) return t;
    }

    const placeholder = el.getAttribute && el.getAttribute("placeholder");
    if (placeholder) return placeholder.trim();

    const title = el.getAttribute && el.getAttribute("title");
    if (title) return title.trim();

    if (el.tagName === "BUTTON" || el.tagName === "A") {
      const t = (el.textContent || "").trim();
      if (t && t.length < 60) return t;
    }

    return null;
  }

  function roleXpath(el, role, name) {
    // Approximate Playwright's getByRole as an XPath
    return `//*[(@role=${xpathLit(role)} or local-name()=${xpathLit(role === "textbox" ? "input" : role)}) and (@aria-label=${xpathLit(name)} or normalize-space(.)=${xpathLit(name)})]`;
  }

  function xpathLit(s) {
    // Handle quotes in text — XPath has no escape, must concat.
    if (!s.includes("'")) return `'${s}'`;
    if (!s.includes('"')) return `"${s}"`;
    return (
      "concat(" +
      s
        .split("'")
        .map((p) => `'${p}'`)
        .join(',"\'",') +
      ")"
    );
  }

  function uniqueCssPath(el) {
    if (!el || el.nodeType !== 1) return null;
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 8) {
      let part = cur.tagName.toLowerCase();
      // Add stable classes
      const stableClasses = Array.from(cur.classList || []).filter(
        (c) =>
          !/^[_-]?[a-z]+__[A-Za-z0-9_-]+$/.test(c) && // CSS-modules
          !/^css-[a-z0-9]+$/i.test(c) && // emotion
          c.length < 30 &&
          !/^\d/.test(c),
      );
      if (stableClasses.length)
        part +=
          "." +
          stableClasses
            .slice(0, 2)
            .map((c) => CSS.escape(c))
            .join(".");

      // If this part disambiguates among siblings, stop here.
      const parent = cur.parentElement;
      if (parent) {
        const matches = parent.querySelectorAll(":scope > " + part);
        if (matches.length > 1) {
          const idx = Array.from(parent.children).indexOf(cur) + 1;
          part += `:nth-child(${idx})`;
        }
      }
      parts.unshift(part);

      // Early exit if the current path is already unique document-wide.
      try {
        if (document.querySelectorAll(parts.join(" > ")).length === 1) break;
      } catch {
        /* invalid intermediate selector, keep going */
      }

      cur = parent;
    }
    return parts.join(" > ");
  }

  // ── Composed-path target resolution (pierces shadow DOM, iframes resolve naturally) ──

  function resolveTarget(ev) {
    const path = ev.composedPath ? ev.composedPath() : [];
    for (const node of path) {
      if (node && node.nodeType === 1) return node;
    }
    return ev.target;
  }

  // ── Position capture ──────────────────────────────────────────────

  function getPosition(el, ev) {
    const pos = {
      viewport: { w: window.innerWidth, h: window.innerHeight },
      scroll: { x: window.scrollX, y: window.scrollY },
    };
    if (
      ev &&
      typeof ev.clientX === "number" &&
      typeof ev.clientY === "number"
    ) {
      pos.client = { x: Math.round(ev.clientX), y: Math.round(ev.clientY) };
      pos.page = {
        x: Math.round(ev.pageX ?? ev.clientX + window.scrollX),
        y: Math.round(ev.pageY ?? ev.clientY + window.scrollY),
      };
    }
    if (el && el.getBoundingClientRect) {
      try {
        const r = el.getBoundingClientRect();
        pos.box = {
          x: Math.round(r.left),
          y: Math.round(r.top),
          w: Math.round(r.width),
          h: Math.round(r.height),
        };
        // Element center — useful as a coord fallback for replay.
        pos.center = {
          x: Math.round(r.left + r.width / 2),
          y: Math.round(r.top + r.height / 2),
        };
      } catch {}
    }
    return pos;
  }

  // ── Listeners ─────────────────────────────────────────────────────

  function recordClick(ev) {
    flushPendingInputs();
    const el = resolveTarget(ev);
    if (!el) return;
    // Only record clicks on interactive elements OR on elements with a click handler.
    const interactive = isInteractive(el);
    if (!interactive) return;

    if (sensitiveField(el)) {
      emit({ op: "click", secret: true, label: "Sensitive field", selectors: [{ kind: "css", value: secretSelector(el) }] });
      return;
    }
    emit({
      op: "click",
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") || implicitRole(el) || null,
      label: accessibleName(el),
      selectors: pickSelectors(el),
      position: getPosition(el, ev),
    });
  }

  function isInteractive(el) {
    if (!el) return false;
    const t = el.tagName;
    if (
      t === "BUTTON" ||
      t === "A" ||
      t === "INPUT" ||
      t === "SELECT" ||
      t === "TEXTAREA" ||
      t === "LABEL" ||
      t === "SUMMARY"
    )
      return true;
    const role = el.getAttribute("role");
    if (
      role &&
      /^(button|link|menuitem|option|checkbox|radio|tab|switch|treeitem)$/.test(
        role,
      )
    )
      return true;
    // Has explicit click handler attribute
    if (el.hasAttribute("onclick")) return true;
    // Closest clickable ancestor (within 3 levels)
    let cur = el,
      hops = 0;
    while (cur && hops < 3) {
      const r = cur.getAttribute && cur.getAttribute("role");
      if (cur.tagName && /^(BUTTON|A)$/.test(cur.tagName)) return true;
      if (r && /^(button|link|menuitem|option|checkbox|radio|tab)$/.test(r))
        return true;
      cur = cur.parentElement;
      hops++;
    }
    return false;
  }

  function emitInput(el) {
    const tag = el.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA" && tag !== "SELECT") return;

    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (
      type === "submit" ||
      type === "button" ||
      type === "reset" ||
      type === "file"
    )
      return;

    if (sensitiveField(el)) {
      emit({ op: "fill", tag: tag.toLowerCase(), type: "password", secret: true,
        label: "Sensitive field", value: null, selectors: [{ kind: "css", value: secretSelector(el) }] });
      return;
    }
    let op, value;
    if (tag === "SELECT") {
      op = "select";
      value = Array.from(el.selectedOptions || [])
        .map((o) => o.value);
      if (!el.multiple) value = value[0] ?? "";
    } else if (type === "checkbox" || type === "radio") {
      op = "check";
      value = el.checked ? "true" : "false";
    } else {
      op = "fill";
      value = el.value;
    }

    const slot = recordedInputs.get(el) || {};
    if (slot.lastEmittedValue === value) return; // dedupe — debounce already emitted
    slot.lastEmittedValue = value;
    recordedInputs.set(el, slot);

    emit({
      op,
      tag: tag.toLowerCase(),
      type,
      multiple: tag === "SELECT" ? Boolean(el.multiple) : undefined,
      label: accessibleName(el),
      value,
      selectors: pickSelectors(el),
      position: getPosition(el, null),
    });
  }

  function recordInputChange(ev) {
    // Fires on blur or Enter for text inputs; fires on click for checkbox/radio/select.
    // This is the primary emit path. emitInput dedupes by value.
    const el = resolveTarget(ev);
    if (el) {
      dirtyInputs.delete(el);
      emitInput(el);
    }
  }

  // Just mark the element dirty — we don't emit on every keystroke.
  // The actual emit happens on:
  //   (a) change event (blur / Enter)
  //   (b) flushPendingInputs() — before any click/submit/keypress
  //   (c) the orphan fallback timer (10s of idle, in case the user types and never blurs)
  function recordTextInput(ev) {
    const el = resolveTarget(ev);
    if (!el) return;
    const tag = el.tagName;
    if (tag !== "INPUT" && tag !== "TEXTAREA") return;
    const type = (el.getAttribute("type") || "text").toLowerCase();
    const isTextLike =
      [
        "text",
        "email",
        "tel",
        "search",
        "url",
        "password",
        "number",
        "date",
        "datetime-local",
        "time",
        "month",
        "week",
      ].includes(type) || tag === "TEXTAREA";
    if (!isTextLike) return;

    dirtyInputs.add(el);

    // Orphan-fallback: if the user types and then walks away without blurring
    // or doing any other interaction, this catches it after 10s.
    const slot = recordedInputs.get(el) || {};
    if (slot.timer) clearTimeout(slot.timer);
    slot.timer = setTimeout(() => {
      slot.timer = null;
      if (dirtyInputs.has(el)) {
        dirtyInputs.delete(el);
        emitInput(el);
      }
    }, 10000);
    recordedInputs.set(el, slot);
  }

  // Flush dirty inputs before a non-input event so trace order matches what
  // the user actually did. emitInput dedupes by value, so multiple calls
  // for the same final value are safe.
  function flushPendingInputs() {
    for (const el of dirtyInputs) {
      const slot = recordedInputs.get(el);
      if (slot && slot.timer) {
        clearTimeout(slot.timer);
        slot.timer = null;
      }
      emitInput(el);
    }
    dirtyInputs.clear();
  }
  const dirtyInputs = new Set();

  function recordSubmit(ev) {
    flushPendingInputs();
    const form = ev.target;
    if (!form) return;
    emit({
      op: "submit",
      tag: "form",
      label: accessibleName(form) || form.getAttribute("name") || null,
      selectors: pickSelectors(form),
      position: getPosition(form, null),
    });
  }

  function recordKey(ev) {
    if (!/^(Enter|Escape|Tab)$/.test(ev.key)) return;
    flushPendingInputs();
    const el = resolveTarget(ev);
    emit({
      op: "press",
      key: ev.key,
      tag: el ? el.tagName.toLowerCase() : null,
      label: el ? (sensitiveField(el) ? "Sensitive field" : accessibleName(el)) : null,
    });
  }

  function recordNav(reason) {
    if (location.href === lastUrl) return;
    const fromUrl = lastUrl;
    lastUrl = location.href;
    emit({
      op: "goto",
      url: location.href,
      from_url: fromUrl,
      reason, // "pushState" | "replaceState" | "popstate" | "navigation"
    });
  }

  // ── Wire up ───────────────────────────────────────────────────────

  document.addEventListener("click", recordClick, {
    capture: true,
    passive: true,
  });
  document.addEventListener("change", recordInputChange, {
    capture: true,
    passive: true,
  });
  document.addEventListener("input", recordTextInput, {
    capture: true,
    passive: true,
  });
  document.addEventListener("submit", recordSubmit, {
    capture: true,
    passive: true,
  });
  document.addEventListener("keydown", recordKey, {
    capture: true,
    passive: true,
  });

  // SPA navigation hooks
  const origPushState = history.pushState;
  history.pushState = function (...args) {
    const r = origPushState.apply(this, args);
    queueMicrotask(() => recordNav("pushState"));
    return r;
  };
  const origReplaceState = history.replaceState;
  history.replaceState = function (...args) {
    const r = origReplaceState.apply(this, args);
    queueMicrotask(() => recordNav("replaceState"));
    return r;
  };
  window.addEventListener("popstate", () => recordNav("popstate"));

  // Full-page navigation marker (first load only — addScriptToEvaluateOnNewDocument
  // re-runs on every new document, so this fires per page).
  emit({ op: "navigation", url: location.href, reason: "document-loaded" });
})();
