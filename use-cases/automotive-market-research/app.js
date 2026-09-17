function agentFetch(url, options = {}) {
  const token = document.querySelector('meta[name="demo-control-token"]')?.content;
  if (!token) throw new Error("Agent controls are available only in the local demo page.");
  return fetch(url, {
    ...options,
    headers: { ...options.headers, "X-Demo-Control-Token": token },
  });
}

const contracts = [
  [
    "PC-2026-04396",
    "Commodity A",
    "John Smith",
    "Supplier A",
    "06-25-2026",
    "$35,886,390.90",
    "Released",
  ],
  [
    "PC-2026-03782",
    "Commodity B",
    "John Smith",
    "Supplier B",
    "06-23-2026",
    "$9,131,618.24",
    "Released",
  ],
  [
    "PC-2026-04631",
    "Commodity C",
    "John Smith",
    "Supplier C",
    "06-23-2026",
    "$1,408,352.94",
    "Released",
  ],
  [
    "PC-2026-03478",
    "Commodity D",
    "John Smith",
    "Supplier D",
    "04-16-2026",
    "$16,828,184.61",
    "Released",
  ],
  [
    "PC-2026-03712",
    "Commodity E",
    "John Smith",
    "Supplier E",
    "06-18-2026",
    "$8,580,918.39",
    "Released",
  ],
  [
    "PC-2026-07068",
    "Commodity F",
    "John Smith",
    "Supplier F",
    "01-08-2026",
    "$1,151,631.76",
    "Released",
  ],
  [
    "PC-2026-03597",
    "Commodity G",
    "John Smith",
    "Supplier G",
    "12-16-2025",
    "$3,058,315.37",
    "Confirmed",
  ],
  [
    "PC-2026-07064",
    "Commodity H",
    "John Smith",
    "Supplier H",
    "02-10-2026",
    "$112,757.79",
    "Ready for release",
  ],
  [
    "PC-2026-09536",
    "Commodity I",
    "John Smith",
    "Supplier I",
    "12-16-2025",
    "$175.90",
    "Released",
  ],
  [
    "PC-2025-62078",
    "Commodity J",
    "John Smith",
    "Supplier J",
    "12-16-2025",
    "$253,822.88",
    "Released",
  ],
];

const items = [
  ["1", "PISTON", "1234", "DC5421", "1 each", "01-01-2026", "12-31-2026"],
  [
    "2",
    "RETAINING RING / GUDGEON PIN",
    "56789",
    "DC5421",
    "212,763 each",
    "01-01-2026",
    "12-31-2026",
  ],
  [
    "3",
    "PISTON",
    "99999",
    "DC5421",
    "103,896 each",
    "01-01-2026",
    "12-31-2026",
  ],
];

const conditionCatalog = {
  "0000": { name: "Pure Base Price", current: 66.885, start: "01-01-2026" },
  1055: {
    name: "Packaging and logistics",
    current: 1.345,
    start: "01-02-2026",
  },
  6889: { name: "Steel price surcharge", current: 2.185, start: "04-01-2026" },
  32753: { name: "Tariffs Sec. 301", current: 2.145, start: "01-01-2026" },
  20014: { name: "Sea freight", current: 0.805, start: "01-01-2026" },
  9977: { name: "Energy surcharge", current: 0.415, start: "04-01-2026" },
};
const reasonCatalog = {
  2391: "Long Term Agreement (eff)",
  8539: "Surcharge adjustment",
  8974: "Sea freight",
  8980: "Tariff adjustment",
  8985: "Energy premium",
  9003: "Market · priceable",
};
const defaultDraft = () => ({
  type: "9977",
  price: "0.380",
  from: "07-01-2026",
  to: "12-31-2026",
  reason: "8985",
});
const state = {
  page: "contracts",
  prepared: false,
  submitted: false,
  running: false,
  manualChanges: [],
  conditionDraft: defaultDraft(),
  liveOutput: null,
};
const sapContent = document.getElementById("sapContent");
const modalLayer = document.getElementById("modalLayer");

function tableRows() {
  return contracts
    .map(
      (c, i) =>
        `<tr data-contract="${i}"><td><span class="checkbox"></span></td><td class="link">${c[0]}</td><td>${c[1]}</td><td class="link">${c[2]}</td><td class="link">${c[3]}</td><td>${c[4]}</td><td>${c[5]} USD</td><td>01-01-2026</td><td>12-31-2026</td><td class="status">${c[6]}</td><td class="arrow">›</td></tr>`,
    )
    .join("");
}

function renderContracts() {
  state.page = "contracts";
  sapContent.innerHTML = `<div class="sap-page">
    <div class="search-area"><h1>Search for Purchase Contracts</h1><div class="search-row">
      <div class="field"><label>Contract Number</label><div class="fieldbox"></div></div><div class="field"><label>Status</label><div class="fieldbox"><span class="token">Released ×</span></div></div>
      <div class="field"><label>Supplier</label><div class="fieldbox"></div></div><div class="field"><label>Responsible Buyer</label><div class="fieldbox"><span class="token">JSMITH ×</span></div></div>
      <div class="field"><label>Contract Validity</label><div class="fieldbox">01-01-2026 – 12-31-2026</div></div><div class="search-action"><button class="primary">Search</button><button class="text-button">Clear</button></div>
    </div></div>
    <div class="table-wrap"><div class="table-toolbar"><h2>Purchase Contracts (119) <span>Standard View⌄</span></h2><div class="table-actions"><span>Merge</span><span>Supplier Change</span><span>Extend</span><span>Transfer</span><span>Delete</span><button class="create">Create</button><span>⚙</span></div></div>
    <table class="data-table"><colgroup><col style="width:28px"><col style="width:125px"><col style="width:190px"><col style="width:125px"><col style="width:190px"><col style="width:130px"><col style="width:145px"><col style="width:115px"><col style="width:115px"><col style="width:105px"><col style="width:20px"></colgroup><thead><tr><th></th><th>Contract No.</th><th>Title</th><th>Responsible Buyer</th><th>Supplier</th><th>Last Version Date</th><th>Contract Value</th><th>Valid From</th><th>Valid To</th><th>Status</th><th></th></tr></thead><tbody>${tableRows()}</tbody></table></div></div>`;
  sapContent
    .querySelectorAll("tr[data-contract]")
    .forEach((row) => (row.onclick = () => renderContract()));
}

function objectHead(title, subtitle, active = "Items") {
  return `<div class="object-head"><div class="head-top"><div><div class="crumb">Purchase Contract PC-2026-03782</div><h1 class="object-title">${title}</h1><div class="subtitle">${subtitle}</div></div><div class="object-actions"><button class="edit-button" id="editObject">Edit</button><span>Administer</span><span>Result</span><span>Extend</span><span>Renegotiate</span><span>•••</span></div></div>
  <div class="meta-grid"><div class="meta"><label>Status</label><strong>Released</strong></div><div class="meta"><label>Version</label><strong>Active</strong></div><div class="meta"><label>Contract value</label><strong>9,131,618.24 USD</strong></div><div class="meta"><label>Supplier</label><strong><a>Supplier B</a></strong></div><div class="meta"><label>Responsible Buyer</label><strong><a>John Smith</a></strong></div><div class="meta"><label>Contract date</label><strong>06-23-2026</strong></div><div class="meta"><label>Fiscal year</label><strong>2026</strong></div></div>
  <div class="tabs">${["General", "Items", "Attachments", "Text", "Approval", "Supplier Response", "Related Documents", "History"].map((t) => `<span class="tab ${t === active ? "active" : ""}">${t}</span>`).join("")}</div></div>`;
}

function renderContract() {
  state.page = "contract";
  sapContent.innerHTML = `<div class="sap-page">${objectHead("PC-2026-03782", "Commodity B")}
  <div class="section"><h2>Items (3)</h2><div class="item-list">${items.map((i, idx) => `<div class="item-row" data-item="${idx}"><div><span class="checkbox"></span></div><div class="item-cell"><strong>${i[0]} · ${i[1]}</strong><small>Latest ZGS: 00${idx + 1}</small></div><div class="item-cell"><a>${i[2]}</a></div><div class="item-cell"><a>${i[3]}</a></div><div class="item-cell"><strong>${i[4]}</strong></div><div class="item-cell">${i[5]}</div><div class="item-cell">${i[6]}</div><div class="arrow">›</div></div>`).join("")}</div></div></div>`;
  sapContent
    .querySelectorAll("[data-item]")
    .forEach((row) => (row.onclick = () => renderItem()));
}

function parseDate(value) {
  const [month, day, year] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function previousDate(value) {
  const date = parseDate(value);
  date.setDate(date.getDate() - 1);
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}-${date.getFullYear()}`;
}

function yearPercent(value) {
  const date = parseDate(value),
    start = new Date(date.getFullYear(), 0, 1),
    end = new Date(date.getFullYear() + 1, 0, 1);
  return Math.max(0, Math.min(100, ((date - start) / (end - start)) * 100));
}

function splitBars(id, fallback) {
  const changes = state.manualChanges
    .filter((change) => change.type === id)
    .sort((a, b) => parseDate(a.from) - parseDate(b.from));
  if (!changes.length) return fallback;
  const meta = conditionCatalog[id];
  let value = meta.current,
    from = meta.start;
  return changes
    .map((change, index) => {
      const start = yearPercent(from),
        end = yearPercent(change.from);
      const old = `<div class="bar" style="left:${start}%;right:${100 - end}%"><strong>${value.toFixed(3)} per 1 EA</strong>${from} – ${previousDate(change.from)}</div>`;
      value = change.price;
      from = change.from;
      const next = changes[index + 1];
      const nextEnd = next ? yearPercent(next.from) : 100;
      const added = `<div class="bar new-segment" style="left:${end}%;right:${100 - nextEnd}%"><span class="new-tag">NEW</span><strong>${value.toFixed(3)} per 1 EA</strong>${from} – ${next ? previousDate(next.from) : change.to}</div>`;
      return old + added;
    })
    .join("");
}

function manualTotalBars() {
  const changes = [...state.manualChanges].sort(
    (a, b) => parseDate(a.from) - parseDate(b.from),
  );
  if (!changes.length)
    return `<div class="bar olive"><strong>87.515 per 1 EA</strong>04-01-2026 – 12-31-2026</div>`;
  let total = 87.515,
    start = "04-01-2026";
  return changes
    .map((change, index) => {
      const pos = yearPercent(change.from),
        begin = yearPercent(start),
        next = changes[index + 1];
      const old = `<div class="bar olive" style="left:${begin}%;right:${100 - pos}%"><strong>${total.toFixed(3)} per 1 EA</strong>${start} – ${previousDate(change.from)}</div>`;
      total += change.price - conditionCatalog[change.type].current;
      start = change.from;
      const nextEnd = next ? yearPercent(next.from) : 100;
      return (
        old +
        `<div class="bar olive new-segment" style="left:${pos}%;right:${100 - nextEnd}%"><span class="new-tag">UPDATED</span><strong>${total.toFixed(3)} per 1 EA</strong>${start} – ${next ? previousDate(next.from) : change.to}</div>`
      );
    })
    .join("");
}

function manualReasonBars() {
  const changes = [...state.manualChanges].sort(
    (a, b) => parseDate(a.from) - parseDate(b.from),
  );
  if (!changes.length)
    return `<div class="bar reason">2391 · Long Term Agreement (eff)</div>`;
  const first = yearPercent(changes[0].from);
  return (
    `<div class="bar reason" style="left:0;right:${100 - first}%">2391 · Long Term Agreement</div>` +
    changes
      .map((change, index) => {
        const start = yearPercent(change.from),
          next = changes[index + 1],
          end = next ? yearPercent(next.from) : 100;
        return `<div class="bar reason new-segment" style="left:${start}%;right:${100 - end}%"><span class="new-tag">NEW</span>${change.reason} · ${reasonCatalog[change.reason]}</div>`;
      })
      .join("")
  );
}

function priceRows() {
  const rows = [
    [
      "0000 Pure Base Price",
      splitBars(
        "0000",
        `<div class="bar"><strong>66.885 per 1 EA</strong>01-01-2026 – 12-31-2026</div>`,
      ),
      "0000",
    ],
    [
      "Base Price",
      state.manualChanges.some((c) => c.type === "0000")
        ? splitBars("0000", "").replaceAll('class="bar', 'class="bar olive')
        : `<div class="bar olive"><strong>66.885 per 1 EA</strong>01-01-2026 – 12-31-2026</div>`,
      "base",
    ],
    [
      "1055 Packaging and logistics",
      splitBars(
        "1055",
        `<div class="bar"><strong>1.345 per 1 EA</strong>01-02-2026 – 12-31-2026</div>`,
      ),
      "1055",
    ],
    [
      "6889 Steel price surcharge",
      `<div class="bar segment-1"><strong>1.995 per 1 EA</strong>01-02-2026 – 03-31-2026</div>${splitBars("6889", `<div class="bar segment-2"><strong>2.185 per 1 EA</strong>04-01-2026 – 12-31-2026</div>`)}`,
      "6889",
    ],
    [
      "32753 Tariffs Sec. 301",
      splitBars(
        "32753",
        `<div class="bar"><strong>2.145 per 1 EA</strong>01-01-2026 – 12-31-2026</div>`,
      ),
      "32753",
    ],
    [
      "20014 Sea freight",
      splitBars(
        "20014",
        `<div class="bar"><strong>0.805 per 1 EA</strong>01-01-2026 – 12-31-2026</div>`,
      ),
      "20014",
    ],
    [
      "9977 Energy surcharge",
      splitBars(
        "9977",
        `<div class="bar"><strong>0.415 per 1 EA</strong>04-01-2026 – 12-31-2026</div>`,
      ),
      "9977",
    ],
    ["Total Price", manualTotalBars(), "total"],
    ["PCR", manualReasonBars(), "pcr"],
  ];
  return rows
    .map(
      (r) =>
        `<div class="price-row" data-condition-row="${r[2] || ""}"><div class="price-label">${r[0]}</div><div class="track">${r[1]}</div></div>`,
    )
    .join("");
}

function renderItem(edit = false) {
  state.page = "item";
  sapContent.innerHTML = `<div class="sap-page">${objectHead("99999", "PISTON", "Price")}${edit ? `<div class="edit-banner"><strong>Edit Purchase Contract Item (3 of 3)</strong><button class="add-condition" id="addCondition">＋ Add condition</button></div>` : ""}
  <div class="section"><div class="timeline-controls"><button class="seg">Days</button><button class="seg active">Months</button><span style="margin-left:15px;color:#a7b5b9;font-size:12px">Plants: &nbsp; <b>5901</b> &nbsp; <b>5900</b></span></div><div class="months">${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m) => `<span>${m}</span>`).join("")}</div><div class="price-grid">${priceRows()}</div></div></div>`;
  document.getElementById("editObject").onclick = () => renderItem(true);
  const add = document.getElementById("addCondition");
  if (add) add.onclick = () => showConditionModal();
}

function showConditionModal() {
  const draft = state.conditionDraft || defaultDraft();
  const condition = conditionCatalog[draft.type] || conditionCatalog["20014"];
  modalLayer.classList.remove("hidden");
  modalLayer.innerHTML = `<div class="modal"><div class="modal-title">Condition</div><div class="modal-body condition-form">
    <div class="form-field"><label>Price Condition Type*</label><div class="lookup"><input id="conditionType" class="form-input" value="${draft.type}"><button id="conditionLookup">⌕</button></div><small>${condition.name}</small></div><div class="form-field"><label>Price effective</label><div class="form-input">Yes</div></div>
    <div class="form-field"><label>Price*</label><input id="conditionPrice" class="form-input" value="${draft.price}"></div><div class="form-field"><label>Unit of Order*</label><input class="form-input" value="1 EA · USD" readonly></div>
    <div class="form-field"><label>Valid From*</label><input id="conditionFrom" class="form-input" value="${draft.from}"></div><div class="form-field"><label>Valid To*</label><input id="conditionTo" class="form-input" value="${draft.to}"></div>
    <div class="form-field"><label>Price Change Reason*</label><div class="lookup"><input id="conditionReason" class="form-input" value="${draft.reason}"><button id="reasonLookup">⌕</button></div><small>${reasonCatalog[draft.reason] || "Select a reason"}</small></div>
  </div><div class="modal-footer"><button class="text-button" id="modalCancel">Cancel</button><button class="primary" id="modalSave">Save</button></div></div>`;
  document.getElementById("modalCancel").onclick = closeModal;
  document.getElementById("modalSave").onclick = saveCondition;
  document.getElementById("conditionLookup").onclick = () => {
    captureDraft();
    showPicker("condition");
  };
  document.getElementById("reasonLookup").onclick = () => {
    captureDraft();
    showPicker("reason");
  };
}

function captureDraft() {
  const byId = (id) => document.getElementById(id)?.value;
  state.conditionDraft = {
    type: byId("conditionType") || state.conditionDraft.type,
    price: byId("conditionPrice") || state.conditionDraft.price,
    from: byId("conditionFrom") || state.conditionDraft.from,
    to: byId("conditionTo") || state.conditionDraft.to,
    reason: byId("conditionReason") || state.conditionDraft.reason,
  };
}

function showToast(message, error = false) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.toggle("error", error);
  toast.classList.remove("hidden");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.add("hidden"), 4200);
}

function saveCondition() {
  captureDraft();
  const draft = state.conditionDraft,
    price = Number(draft.price),
    from = parseDate(draft.from),
    to = parseDate(draft.to);
  if (
    !conditionCatalog[draft.type] ||
    !Number.isFinite(price) ||
    !(from instanceof Date) ||
    Number.isNaN(from.valueOf()) ||
    to < from ||
    !reasonCatalog[draft.reason]
  ) {
    showToast("Please complete all required condition fields.", true);
    return;
  }
  const dateConflict = state.manualChanges.find(
    (change) =>
      change.from === draft.from &&
      (change.type !== draft.type || change.reason !== draft.reason),
  );
  if (dateConflict) {
    showToast(
      `Only one price change reason can be used on ${draft.from}. Choose another effective date.`,
      true,
    );
    return;
  }
  const change = { ...draft, price };
  state.manualChanges = state.manualChanges.filter(
    (item) => item.type !== change.type,
  );
  state.manualChanges.push(change);
  closeModal();
  renderItem(true);
  showToast(
    `✓ ${conditionCatalog[change.type].name} added — calendar and total price updated`,
  );
  requestAnimationFrame(() =>
    document
      .querySelector(`[data-condition-row="${change.type}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" }),
  );
}

function showPicker(type) {
  const conditions = [
    ["0000", "Absolute", "Pure Base Price", "Base price"],
    ["1055", "Absolute", "Packaging and logistics", "General add"],
    ["6889", "Absolute", "Steel price surcharge", "Raw material"],
    ["32753", "Absolute", "Tariffs Sec. 301", "Tariff"],
    ["20014", "Absolute", "Sea freight", "Logistics"],
    ["9977", "Absolute", "Energy surcharge", "Energy"],
  ];
  const reasons = [
    ["2391", "Long Term Agreement (eff)", "Commercial"],
    ["8539", "Surcharge adjustment", "Commercial"],
    ["8974", "Sea freight", "Logistics"],
    ["8980", "Tariff adjustment", "Commercial"],
    ["8985", "Energy premium", "Commercial"],
    ["9003", "Market · priceable", "Technical"],
  ];
  const rows = type === "condition" ? conditions : reasons;
  modalLayer.innerHTML = `<div class="modal picker-modal"><div class="modal-title">${type === "condition" ? "Price Condition Type" : "Price Change Reason"}</div><div class="modal-body"><div class="picker-search"><input placeholder="Search"><button class="primary">Go</button></div><table class="picker-table"><thead><tr>${(type === "condition" ? ["Condition ID", "Price delta type", "Description", "Category"] : ["Code", "Description", "Category"]).map((x) => `<th>${x}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></div><div class="modal-footer"><button class="text-button" id="modalCancel">Cancel</button></div></div>`;
  document.getElementById("modalCancel").onclick = () => showConditionModal();
  modalLayer.querySelectorAll("tbody tr").forEach(
    (row, index) =>
      (row.onclick = () => {
        if (type === "condition") {
          const selected = rows[index][0],
            meta = conditionCatalog[selected];
          state.conditionDraft = {
            ...state.conditionDraft,
            type: selected,
            price: meta.current.toFixed(3),
          };
        } else
          state.conditionDraft = {
            ...state.conditionDraft,
            reason: rows[index][0],
          };
        showConditionModal();
      }),
  );
}

function closeModal() {
  modalLayer.classList.add("hidden");
  modalLayer.innerHTML = "";
}

function extractAgentSteps(payload) {
  const messages = Array.isArray(payload)
      ? payload
      : payload?.messages || payload?.data || [],
    steps = [];
  const add = (value) => {
    const text = String(value || "")
      .replace(
        /https:\/\/[^\s]+trycloudflare\.com[^\s]*/g,
        "secure localhost URL",
      )
      .replace(/\s+/g, " ")
      .trim();
    if (text && text.length > 8 && !steps.includes(text))
      steps.push(text.slice(0, 150));
  };
  for (const message of messages) {
    for (const part of message.parts ||
      message.message?.content ||
      message.content ||
      []) {
      if (part.type === "text") add(part.text);
      else if (part.type === "reasoning") add(part.text || part.reasoning);
      else if (part.type === "tool-call") {
        if (part.toolName === "codeEvaluate")
          add("Running pricing calculation in Agent sandbox");
        else if (part.toolName === "httpFetch" || part.toolName === "httpProbe")
          add("Fetching live public market data");
        else
          add(part.toolName ? `Using ${part.toolName}` : "Using browser tool");
      }
    }
  }
  return steps.slice(-7);
}

function escapeResultText(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function renderAgentSteps(steps, terminalClass) {
  const list = document.getElementById("steps");
  list.innerHTML = steps
    .map(
      (text, index) =>
        `<li class="${terminalClass || (index === steps.length - 1 ? "active" : "done")}">${escapeResultText(text)}</li>`,
    )
    .join("");
}

function validResultDate(value, iso = false) {
  if (typeof value !== "string") return null;
  const match = value.match(iso ? /^(\d{4})-(\d{2})-(\d{2})$/ : /^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return null;
  const year = Number(match[iso ? 1 : 3]), month = Number(match[iso ? 2 : 1]), day = Number(match[iso ? 3 : 2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date.getTime() : null;
}

function hydrateAgentResult(runState) {
  const output = runState?.result?.output;
  const finiteNumber = value => typeof value === "number" && Number.isFinite(value);
  if (runState?.status !== "COMPLETED" || !output || output.success !== true
    || output.runtimeCalculationUsed !== true
    || output.contractId !== "PC-2026-03782" || output.itemId !== "99999"
    || output.sourceUrl !== "https://fred.stlouisfed.org/graph/fredgraph.csv?id=MCOILWTICO"
    || output.indexSeries !== "MCOILWTICO"
    || typeof output.calculationArtifact !== "string" || !output.calculationArtifact.trim()
    || typeof output.verification !== "string" || !output.verification.trim()
    || !Array.isArray(output.adjustments) || output.adjustments.length !== 1) return false;
  const previousDate = validResultDate(output.previousObservationDate, true);
  const latestDate = validResultDate(output.latestObservationDate, true);
  if (previousDate === null || latestDate === null || previousDate >= latestDate
    || !finiteNumber(output.previousObservationValue) || output.previousObservationValue <= 0
    || !finiteNumber(output.latestObservationValue) || output.latestObservationValue <= 0
    || !finiteNumber(output.indexChangePct) || !finiteNumber(output.totalPrice)) return false;
  const movement = (output.latestObservationValue - output.previousObservationValue) / output.previousObservationValue;
  const expectedPrice = Math.round((0.415 * (1 + movement * 0.5) + Number.EPSILON) * 1000) / 1000;
  const expectedTotal = Math.round((87.515 + expectedPrice - 0.415 + Number.EPSILON) * 1000) / 1000;
  const adjustment = output.adjustments[0];
  if (!adjustment || typeof adjustment.condition !== "string" || typeof adjustment.reason !== "string"
    || !/^9977(?:[\s·:–-]+Energy surcharge)?$/i.test(adjustment.condition.trim())
    || !/^8985(?:[\s·:–-]+Energy premium)?$/i.test(adjustment.reason.trim())
    || !finiteNumber(adjustment.newPrice) || adjustment.newPrice <= 0
    || validResultDate(adjustment.effectiveDate) === null || adjustment.effectiveDate !== "07-01-2026"
    || Math.abs(adjustment.newPrice - expectedPrice) > 1e-9
    || Math.abs(output.totalPrice - expectedTotal) > 1e-9
    || Math.abs(output.indexChangePct - movement * 100) > 0.001) return false;
  let artifact;
  try { artifact = JSON.parse(output.calculationArtifact); }
  catch { return false; }
  const expectedArtifact = {
    sourceUrl: output.sourceUrl, indexSeries: output.indexSeries,
    previousObservationDate: output.previousObservationDate, previousObservationValue: output.previousObservationValue,
    latestObservationDate: output.latestObservationDate, latestObservationValue: output.latestObservationValue,
    currentPrice: 0.415, passThrough: 0.5, baselineTotal: 87.515,
    contractId: output.contractId, itemId: output.itemId, condition: "9977", reason: "8985",
    effectiveDate: "07-01-2026", validTo: "12-31-2026", newPrice: expectedPrice, totalPrice: expectedTotal,
  };
  if (!artifact || Array.isArray(artifact) || typeof artifact !== "object"
    || Object.entries(expectedArtifact).some(([key, value]) => artifact[key] !== value)) return false;
  const changes = [{ type: "9977", reason: "8985", price: adjustment.newPrice, from: adjustment.effectiveDate, to: "12-31-2026" }];
  state.manualChanges = changes;
  state.liveOutput = output;
  state.conditionDraft = { ...changes[0], price: changes[0].price.toFixed(3) };
  const annualImpact = changes.reduce(
    (sum, change) =>
      sum + (change.price - conditionCatalog[change.type].current) * 103896,
    0,
  );
  const impact = document.getElementById("impactValue");
  if (impact)
    impact.textContent = `${annualImpact < 0 ? "−" : annualImpact > 0 ? "+" : ""}$${Math.abs(annualImpact).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return true;
}

async function runAgent() {
  if (state.running) return;
  state.running = true;
  state.prepared = false;
  state.liveOutput = null;
  state.submitted = false;
  state.conditionDraft = defaultDraft();
  const impact = document.getElementById("impactValue");
  if (impact) impact.textContent = "Awaiting verified result";
  state.manualChanges = [];
  state.pollToken = (state.pollToken || 0) + 1;
  const token = state.pollToken;
  renderContracts();
  const run = document.getElementById("runButton"),
    box = document.getElementById("runStatus"),
    bar = document.getElementById("progressBar"),
    timer = document.getElementById("statusTimer"),
    label = document.getElementById("statusLabel"),
    sessionLink = document.getElementById("sessionLink");
  run.disabled = true;
  run.innerHTML = "<span>●</span> Starting Browserbase Agent";
  box.classList.remove("hidden");
  sessionLink.classList.add("hidden");
  document.getElementById("reviewCard").classList.add("hidden");
  label.textContent = "Starting";
  bar.style.width = "8%";
  renderAgentSteps(["Creating secure localhost tunnel…"]);
  let seconds = 0;
  const tick = setInterval(() => {
    seconds++;
    timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }, 1000);
  try {
    const response = await agentFetch("/api/agent/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      created = await response.json();
    if (!response.ok)
      throw new Error(created.error || "Unable to start Browserbase Agent");
    state.lastRun = created;
    label.textContent = "Pending";
    bar.style.width = "18%";
    run.innerHTML = "<span>●</span> Browserbase Agent running";
    renderAgentSteps([
      "Secure tunnel ready",
      "Browserbase Agent run created",
      "Waiting for cloud browser session…",
    ]);
    const terminal = ["COMPLETED", "FAILED", "STOPPED", "TIMED_OUT"];
    while (state.pollToken === token) {
      const [runResponse, messageResponse] = await Promise.all([
        agentFetch(`/api/agent/runs/${created.runId}`),
        agentFetch(`/api/agent/runs/${created.runId}/messages`),
      ]);
      const runState = await runResponse.json(),
        messagePayload = messageResponse.ok ? await messageResponse.json() : {};
      if (!runResponse.ok)
        throw new Error(runState.error || "Unable to read Agent status");
      state.lastRun = runState;
      label.textContent =
        runState.status === "RUNNING"
          ? "Agent working"
          : runState.status.charAt(0) + runState.status.slice(1).toLowerCase();
      bar.style.width =
        runState.status === "PENDING"
          ? "25%"
          : runState.status === "RUNNING"
            ? "62%"
            : "100%";
      if (runState.sessionUrl) {
        sessionLink.href = runState.sessionUrl;
        sessionLink.classList.remove("hidden");
      }
      const liveSteps = extractAgentSteps(messagePayload);
      renderAgentSteps(
        liveSteps.length
          ? liveSteps
          : ["Browserbase Agent is observing the SAP portal…"],
      );
      if (terminal.includes(runState.status)) {
        clearInterval(tick);
        state.running = false;
        if (runState.status === "COMPLETED") {
          if (!hydrateAgentResult(runState)) {
            const explanation = runState.result?.output?.verification;
            throw new Error(typeof explanation === "string" && explanation.trim()
              ? `Result not accepted: ${explanation.trim().slice(0, 500)}`
              : "Agent completed without a valid calculation and verification result");
          }
          state.prepared = true;
          renderItem();
          renderAgentSteps(
            liveSteps.length
              ? liveSteps
              : ["Agent completed the SAP update and verification"],
            "done",
          );
          run.classList.add("hidden");
          document.getElementById("reviewCard").classList.remove("hidden");
          showToast(
            "✓ Calculation checked; agent reports the calendar update verified. Review before approval.",
          );
        } else {
          const reason =
            runState.cause?.message ||
            `Agent run ${runState.status.toLowerCase()}`;
          renderAgentSteps([...liveSteps, reason], "failed");
          run.disabled = false;
          run.innerHTML = "<span>↻</span> Retry Browserbase Agent";
          showToast(reason, true);
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  } catch (error) {
    clearInterval(tick);
    state.running = false;
    label.textContent = "Failed";
    bar.style.width = "100%";
    renderAgentSteps([error.message], "failed");
    run.disabled = false;
    run.innerHTML = "<span>↻</span> Retry Browserbase Agent";
    showToast(error.message, true);
  }
}

function showReview() {
  const changes = state.manualChanges;
  const output = state.liveOutput || {};
  const annualImpact = changes.reduce(
    (sum, change) =>
      sum + (change.price - conditionCatalog[change.type].current) * 103896,
    0,
  );
  const impact = `${annualImpact < 0 ? "−" : annualImpact > 0 ? "+" : ""}$${Math.abs(annualImpact).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const rows = changes
    .map((change) => {
      const current = conditionCatalog[change.type].current,
        delta = change.price - current;
      return `<tr><td>${change.type} · ${conditionCatalog[change.type].name}</td><td>$${current.toFixed(3)}</td><td class="${delta < 0 ? "decrease" : ""}">$${change.price.toFixed(3)} ${delta < 0 ? "↓" : delta > 0 ? "↑" : "→"}</td><td>${change.from}</td><td>${change.reason} · ${reasonCatalog[change.reason]}</td></tr>`;
    })
    .join("");
  const observationText =
    output.previousObservationDate && output.latestObservationDate
      ? `${output.indexSeries || "MCOILWTICO"} moved from ${output.previousObservationValue} on ${output.previousObservationDate} to ${output.latestObservationValue} on ${output.latestObservationDate}; 50% pass-through applied.`
      : "Live public observations and contract formula verified.";
  modalLayer.classList.remove("hidden");
  modalLayer.innerHTML = `<div class="modal review-modal"><div class="modal-title"><span>Review prepared change</span><span style="font-size:11px;color:#777986">Buyer approval required</span></div><div class="modal-body"><div class="review-summary"><div class="summary-box"><span>Purchase contract</span><strong>${output.contractId || "PC-2026-03782"}</strong></div><div class="summary-box"><span>Item</span><strong>${output.itemId || "99999"}</strong></div><div class="summary-box"><span>Projected annual impact</span><strong style="color:#078052">${impact}</strong></div></div>
  <table class="change-table"><thead><tr><th>Condition</th><th>Current</th><th>New</th><th>Effective</th><th>Reason</th></tr></thead><tbody>${rows}</tbody></table><div class="validation"><strong>✓</strong> ${observationText} Expected Total Price: $${Number(output.totalPrice || manualTotal()).toFixed(3)}.</div></div>
  <div class="modal-footer"><button class="text-button" id="reviewCancel" style="color:#5f6170">Return to SAP</button><button class="submit-approval" id="submitApproval">Submit for manager approval</button></div></div>`;
  document.getElementById("reviewCancel").onclick = closeModal;
  document.getElementById("submitApproval").onclick = submitApproval;
}
function submitApproval() {
  state.submitted = true;
  closeModal();
  const toast = document.getElementById("toast");
  toast.textContent =
    "✓ Submitted to purchasing manager · SAP workflow 8002841";
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 4200);
}
function manualTotal() {
  return state.manualChanges.reduce(
    (total, change) =>
      total + change.price - conditionCatalog[change.type].current,
    87.515,
  );
}
function reset() {
  state.pollToken = (state.pollToken || 0) + 1;
  state.prepared = false;
  state.submitted = false;
  state.running = false;
  state.manualChanges = [];
  state.liveOutput = null;
  state.conditionDraft = defaultDraft();
  renderContracts();
  document.getElementById("runStatus").classList.add("hidden");
  document.getElementById("reviewCard").classList.add("hidden");
  document.getElementById("sessionLink").classList.add("hidden");
  const impact = document.getElementById("impactValue");
  if (impact) impact.textContent = "Calculated live";
  const run = document.getElementById("runButton");
  run.classList.remove("hidden");
  run.disabled = false;
  run.innerHTML = "<span>▶</span> Run Browserbase Agent";
  closeModal();
}

document.getElementById("runButton").onclick = runAgent;
document.getElementById("reviewButton").onclick = showReview;
document.getElementById("resetButton").onclick = reset;
document.getElementById("agentToggle").onclick = () =>
  document.getElementById("agentPanel").classList.toggle("closed");
document.getElementById("panelClose").onclick = () =>
  document.getElementById("agentPanel").classList.add("closed");
document.getElementById("backButton").onclick = () =>
  state.page === "item" ? renderContract() : renderContracts();
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    document.getElementById("agentPanel").classList.toggle("closed");
  }
  if (e.key === "Escape") closeModal();
});
renderContracts();
