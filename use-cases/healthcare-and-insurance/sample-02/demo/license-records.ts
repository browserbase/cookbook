import { parse } from "csv-parse/sync";

const requiredFields = ["Site", "FirstName", "LastName", "LicenseNumber"];

export function parseLicenseRecords(csv: string): Record<string, string>[] {
  let rows: { record: string[]; info: { lines: number } }[];
  try {
    const parsed: unknown = parse(csv, {
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      info: true,
    });
    rows = parsed as typeof rows;
  } catch (error) {
    const line = typeof error === "object" && error !== null && "lines" in error
      && typeof error.lines === "number" ? error.lines : undefined;
    throw new Error(`Invalid CSV${line ? ` near line ${line}` : ""}. Check quoting and delimiters.`);
  }
  rows = rows.filter(({ record }) => record.some(value => value.trim() !== ""));
  if (rows.length === 0) throw new Error("CSV header is missing.");
  const headers = rows[0].record.map(value => value.trim());
  if (headers.some(value => !value || ["__proto__", "constructor", "prototype"].includes(value))
    || new Set(headers).size !== headers.length) {
    throw new Error(`Invalid or duplicate CSV header at line ${rows[0].info.lines}.`);
  }
  for (const field of requiredFields) {
    if (!headers.includes(field)) throw new Error(`CSV header at line ${rows[0].info.lines} requires ${field}.`);
  }
  return rows.slice(1).map(({ record, info }) => {
    const location = `CSV record ending at line ${info.lines}`;
    if (record.length !== headers.length) throw new Error(`${location}: expected ${headers.length} fields, received ${record.length}.`);
    const result = Object.fromEntries(headers.map((header, index) => [header, record[index].trim()]));
    for (const field of requiredFields) {
      if (!result[field]) throw new Error(`${location}: ${field} is required.`);
    }
    let target: URL;
    try { target = new URL(result.Site); }
    catch { throw new Error(`${location}: Site must be an absolute HTTP(S) URL.`); }
    if (!/^https?:\/\//i.test(result.Site) || !["http:", "https:"].includes(target.protocol) || !target.hostname
      || target.username || target.password || result.Site.includes("\\") || /[\s\u0000-\u001f\u007f]/.test(result.Site)) {
      throw new Error(`${location}: Site must be an absolute HTTP(S) URL without credentials or whitespace.`);
    }
    if (Boolean(result.CaptchaImage) !== Boolean(result.CaptchaInput)) {
      throw new Error(`${location}: provide both CaptchaImage and CaptchaInput, or leave both blank.`);
    }
    return result;
  });
}
