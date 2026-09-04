/**
 * Clean-schema CSV output. Ported/trimmed from the demo repo's `src/csv.ts` + `src/transform.ts` so each
 * function returns the SAME import-ready columns we settled on there. Phase 1 covers services, clients, and
 * team-members; the remaining mappers come over in Phase 2.
 */

// ── CSV primitives (from src/csv.ts) ──────────────────────────────────────────────────────────────
export function parseCsv(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r") {
      /* skip */
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseCsvObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((r) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => {
      o[h] = r[i] ?? "";
    });
    return o;
  });
}

function quote(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const cell = (v: string | number | null | undefined) =>
    quote(v == null ? "" : String(v));
  return (
    [
      headers.map(quote).join(","),
      ...rows.map((r) => r.map(cell).join(",")),
    ].join("\r\n") + "\r\n"
  );
}

// ── per-extraction mappers → clean schema CSV ─────────────────────────────────────────────────────

/** services-list: the page.evaluate already returns the schema shape; just serialize. */
export function servicesCsv(rows: any[]): string {
  const out = rows.map((s) => [
    s.name || "",
    s.description || "",
    s.category_name || "",
    s.duration || "",
    s.price || "",
    s.price_varies ? "TRUE" : "FALSE",
    s.processing_duration || "",
    s.trailing_buffer_duration || "",
    s.parent_service_name || "",
  ]);
  return toCsv(
    [
      "name",
      "description",
      "category_name",
      "Duration",
      "price",
      "price_varies",
      "processing_duration",
      "trailing_buffer_duration",
      "parent_service_name",
    ],
    out,
  );
}

/** team-members: the page.evaluate returns the schema shape; just serialize. */
export function teamMembersCsv(rows: any[]): string {
  const out = rows.map((m) => [
    m.firstName || "",
    m.lastName || "",
    m.email || "",
    m.phone || "",
    m.permissionLevel || "",
    m.location || "",
    m.services || "",
  ]);
  return toCsv(
    [
      "First name",
      "Last name",
      "Email",
      "Phone number",
      "Permission level",
      "Location",
      "Services",
    ],
    out,
  );
}

/** Parse an explicitly offset ISO instant without normalizing invalid calendar dates. */
function appointmentInstant(value: unknown): Date {
  if (typeof value !== "string") throw new Error("Appointment timestamp must include an explicit timezone offset");
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) throw new Error("Appointment timestamp must be an offset ISO date-time");
  const [, day, hour, minute, second = "00", fraction = "", zone] = match;
  const calendar = new Date(`${day}T00:00:00.000Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== day || +hour > 23 || +minute > 59 || +second > 59)
    throw new Error("Invalid appointment calendar date or time");
  if (zone === "-00:00") throw new Error("Appointment timezone offset is unknown");
  const offsetHour = zone === "Z" ? 0 : +zone.slice(1, 3);
  const offsetMinute = zone === "Z" ? 0 : +zone.slice(4, 6);
  if (offsetHour > 23 || offsetMinute > 59) throw new Error("Invalid appointment timezone offset");
  const offset = (zone.startsWith("-") ? -1 : 1) * (offsetHour * 60 + offsetMinute);
  const instant = new Date(calendar.getTime() + ((+hour * 60 + +minute - offset) * 60 + +second) * 1000 + +(fraction + "000").slice(0, 3));
  if (instant.getUTCFullYear() < 0 || instant.getUTCFullYear() > 9999) throw new Error("Appointment timestamp exceeds export year range");
  return instant;
}
const isoDateTimeGmt = (value: unknown): string =>
  appointmentInstant(value).toISOString().slice(0, 16).replace("T", " ") + " GMT";
const money = (m: { amount?: number } | null | undefined): string =>
  m && typeof m.amount === "number" ? `$${(m.amount / 100).toFixed(2)}` : "";
const durationMins = (start: string, end: string): string => {
  const a = appointmentInstant(start).getTime(),
    b = appointmentInstant(end).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && b > a
    ? `${Math.round((b - a) / 60000)} minutes`
    : "";
};

/** appointments: normalized reservations → the 11-column schema (incl. Recurrence Rule). */
export function appointmentsCsv(rows: any[]): string {
  const out = rows.map((r) => [
    isoDateTimeGmt(r.dateStart),
    (r.serviceNames || []).join("; "),
    r.clientName || "",
    r.clientEmail || "",
    r.clientPhone || "",
    (r.staffNames || []).join("; "),
    r.status || "",
    durationMins(r.dateStart, r.dateEnd),
    r.locationName || "",
    money(r.totalMoney),
    r.rrule || "",
  ]);
  return toCsv(
    [
      "Appt Date and Time",
      "Services",
      "Client name",
      "Client email",
      "Client phone number",
      "Provider",
      "Appt Status",
      "Appt duration",
      "Location",
      "Price/Amount",
      "Recurrence Rule (rrule)",
    ],
    out,
  );
}

const isoDateTimeSec = (s: string): string => {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(s || "");
  return m ? `${m[1]} ${m[2]}` : s || "";
};

/** unavailabilities: calendar events → schema. location_name left blank (event carries tzid, not a name). */
export function unavailabilitiesCsv(rows: any[]): string {
  const out = rows.map((e) => [
    e.name || "",
    isoDateTimeSec(e.dateStart),
    isoDateTimeSec(e.dateEnd),
    e.staffId || "",
    "",
  ]);
  return toCsv(
    [
      "description",
      "start_time",
      "end_time",
      "business_member_token",
      "location_name",
    ],
    out,
  );
}

/** packages: explode each package's bundle into one row per (service, credit_amount). */
export function packagesCsv(packages: any[]): string {
  const out: (string | number | null)[][] = [];
  for (const p of packages) {
    const bundle = Array.isArray(p.bundle) ? p.bundle : [];
    if (bundle.length)
      for (const b of bundle)
        out.push([
          p.package_title || "",
          b.catalog_item_name || "",
          b.credit_amount ?? "",
        ]);
    else out.push([p.package_title || "", "", ""]);
  }
  return toCsv(["package_title", "catalog_item_name", "credit_amount"], out);
}

/** reviews: rating = Square sentiment (POSITIVE/NEGATIVE); client_email blank (no clients artifact in-fn). */
export function reviewsCsv(rows: any[]): string {
  const out = rows.map((r) => [
    r.sentiment || "",
    "",
    r.services_names || "",
    r.comment || "",
    r.created || "",
    "",
  ]);
  return toCsv(
    [
      "rating",
      "client_email",
      "services_names",
      "message",
      "created_at",
      "hidden",
    ],
    out,
  );
}

/** client-packages: direct 1:1 to schema. */
export function clientPackagesCsv(rows: any[]): string {
  const out = rows.map((c) => [
    c.package_title || "",
    c.client_token || "",
    c.client_name || "",
    c.catalog_item_name || "",
    c.expires_at || "",
    c.credits_remaining ?? "",
  ]);
  return toCsv(
    [
      "package_title",
      "client_token",
      "client_name",
      "catalog_item_name",
      "expires_at",
      "credits_remaining",
    ],
    out,
  );
}

/** products: catalog-derived retail rows → schema. Stock fields blank (need inventory API). */
export function productsCsv(rows: any[]): string {
  const out = rows.map((r) => [
    r.name || "",
    r.brand || "",
    r.price || "",
    r.count || "",
    r.intended_uses || "",
    r.business_cost || "",
    r.barcode || "",
    r.optional_info || "",
    r.location_name || "",
    r.category || "",
    r.size || "",
    r.color || "",
    r.low_quantity_level || "",
  ]);
  return toCsv(
    [
      "name",
      "brand",
      "price",
      "count",
      "intended_uses",
      "business_cost",
      "barcode",
      "optional_info",
      "location_name",
      "category",
      "size",
      "color",
      "low_quantity_level",
    ],
    out,
  );
}

/** customer-list (deterministic): SearchAndGetCustomers rows → clients schema. Consent blank (not in protobuf flags). */
export function customersCsv(rows: any[]): string {
  const out: (string | number | null)[][] = [];
  for (const c of rows) {
    const name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
    const email = (c.email || "").trim();
    const phone = (c.phone || "").replace(/^'/, "").trim();
    if (!name && !email && !phone) continue;
    out.push([name, email, phone, ""]);
  }
  return toCsv(
    [
      "Client name",
      "Client email",
      "Client phone number",
      "Marketing consent flags",
    ],
    out,
  );
}

/**
 * customer-notes (agent/export path): parse Square's native notes export CSV
 * (`Customer ID, Note ID, Display Name, Note CreatedAt, Note Content`) → the Sample Organization client-notes
 * schema. Square gives name/date/note. `Note author` is always blank (Square's export omits who wrote it).
 * `Client email` / `Client phone number` are joined DOWNSTREAM by Customer ID from the clients export
 * (`square-customer-list`) — not available within this single function — so they're blank here.
 */
export function clientNotesCsv(squareCsv: string): {
  csv: string;
  rows: number;
} {
  const objs = parseCsvObjects(squareCsv);
  const isoDate = (s: string): string => {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(s || "");
    return m ? m[1] : s || "";
  };
  const out: (string | number | null)[][] = [];
  for (const o of objs) {
    const name = (o["Display Name"] || "").trim();
    const note = (o["Note Content"] || "").trim();
    if (!name && !note) continue;
    out.push([name, "", "", isoDate(o["Note CreatedAt"] || ""), "", note]);
  }
  return {
    csv: toCsv(
      [
        "Client name",
        "Client email",
        "Client phone number",
        "Note creation date",
        "Note author",
        "Client note",
      ],
      out,
    ),
    rows: out.length,
  };
}

/** customer-list (agent/export path): parse Square's raw export CSV, map to the 4-column clients schema. */
export function clientsCsv(squareCsv: string): { csv: string; rows: number } {
  const objs = parseCsvObjects(squareCsv);
  const out: string[][] = [];
  for (const o of objs) {
    const name = `${o["First Name"] || ""} ${o["Last Name"] || ""}`.trim();
    const email = (o["Email Address"] || "").trim();
    const phone = (o["Phone Number"] || "").replace(/^'/, "").trim();
    if (!name && !email && !phone) continue;
    const sub = (o["Email Subscription Status"] || "").trim().toLowerCase();
    const consent =
      sub === "subscribed" ? "True" : sub === "unsubscribed" ? "False" : "";
    out.push([name, email, phone, consent]);
  }
  return {
    csv: toCsv(
      [
        "Client name",
        "Client email",
        "Client phone number",
        "Marketing consent flags",
      ],
      out,
    ),
    rows: out.length,
  };
}
