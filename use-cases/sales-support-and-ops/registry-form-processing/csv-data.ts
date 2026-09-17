import { parseString, writeToString } from "fast-csv";

export function validateColumns(columns: unknown): asserts columns is string[] {
  if (!Array.isArray(columns) || columns.length === 0 ||
      columns.some(column => typeof column !== "string" || column.trim() === "") ||
      new Set(columns).size !== columns.length) {
    throw new Error("CSV columns must be nonempty, unique names.");
  }
}

export async function parseLookupInput(text: string): Promise<Record<string, string>> {
  const rows = await new Promise<string[][]>((resolve, reject) => {
    const rows: string[][] = [];
    parseString(text.replace(/^\uFEFF/, ""), { headers: false, trim: false, ignoreEmpty: false })
      .on("error", () => reject(new Error("Invalid CSV input.")))
      .on("data", (row: string[]) => rows.push(row))
      .on("end", () => resolve(rows));
  });
  const [columns, ...records] = rows;
  validateColumns(columns);
  if (records.length !== 1) throw new Error("Provide exactly one lookup record below the CSV header.");
  if (records[0].length !== columns.length) throw new Error("CSV record width must match the header.");
  return Object.fromEntries(columns.map((column, index) => [column, records[0][index]]));
}

export async function tableCsv(columns: string[], records: Record<string, string>[]): Promise<string> {
  validateColumns(columns);
  if (!Array.isArray(records)) throw new Error("Expected an array of table rows.");
  const rows = records.map(record => {
    if (!record || typeof record !== "object" || columns.some(column =>
      !Object.hasOwn(record, column) || typeof record[column] !== "string")) {
      throw new Error("Every table row must contain a string value for each column.");
    }
    return columns.map(column => record[column]);
  });
  // Include the header as a row so an empty result still produces a valid CSV header.
  return writeToString([columns, ...rows], { rowDelimiter: "\r\n", includeEndRowDelimiter: true, quoteColumns: true });
}
