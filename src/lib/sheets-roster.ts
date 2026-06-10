/**
 * 從 Google 試算表（gviz）讀取名單 + 座位表 — A 版資料來源
 */

export const DEFAULT_SPREADSHEET_ID =
  "1GzToDiDVuLfDZ4Y67BABloyaldCgqv1zwtoT7UNJnYs";

export const DEFAULT_ROSTER_SHEETS = ["801A名單", "804A名單", "806B名單"];

export type SheetStudent = {
  group: string;
  class: string;
  number: string;
  name: string;
  bonus?: number;
};

export type SheetSeatingEntry = {
  state: Record<string, unknown>;
  savedAt?: string;
};

export type SheetGroupBundle = {
  sheetName: string;
  students: SheetStudent[];
  seating?: SheetSeatingEntry;
};

function cellValue(cell: { v?: unknown; f?: string } | null): string {
  if (!cell || cell.v == null || cell.v === "") return "";
  if (typeof cell.v === "string") return cell.v.trim();
  if (typeof cell.v === "number") return String(cell.v);
  return String(cell.f ?? cell.v).trim();
}

export function parseGvizResponse(text: string): string[][] {
  const match = text.match(/setResponse\(([\s\S]+)\)\s*;?\s*$/);
  if (!match) throw new Error("無法解析試算表 gviz 回應");
  const payload = JSON.parse(match[1]) as {
    table?: { rows?: Array<{ c?: Array<{ v?: unknown; f?: string } | null> }> };
  };
  return (payload.table?.rows ?? []).map((row) =>
    (row.c ?? []).map((cell) => cellValue(cell)),
  );
}

export function detectHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(4, rows.length); i++) {
    const joined = (rows[i] ?? []).join("|");
    if (joined.includes("姓名") && joined.includes("座號")) return i;
    const textCount = (rows[i] ?? []).filter((v) => {
      if (v === "" || v == null) return false;
      return Number.isNaN(Number(String(v).trim()));
    }).length;
    if (textCount >= 3) return i;
  }
  return 0;
}

export function parseStudentsFromRows(
  rows: string[][],
  sheetName: string,
): SheetStudent[] {
  if (rows.length < 2) return [];

  const headerIdx = detectHeaderRow(rows);
  const students: SheetStudent[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const name = String(r[3] ?? "").trim();
    if (!name) continue;
    const bonusRaw = String(r[4] ?? "").trim();
    const bonus = bonusRaw ? Number(bonusRaw) : undefined;
    students.push({
      group: String(r[0] ?? "").trim(),
      class: String(r[1] ?? "").trim(),
      number: String(r[2] ?? "").trim(),
      name,
      bonus: bonus != null && !Number.isNaN(bonus) ? bonus : undefined,
    });
  }

  students.sort(
    (a, b) =>
      a.class.localeCompare(b.class, "zh-TW") ||
      Number(a.number) - Number(b.number),
  );

  if (!students.length) {
    console.warn(`  ⚠ 分頁「${sheetName}」沒有有效學生列`);
  }

  return students;
}

export function parseSeatingMap(
  rows: string[][],
): Map<string, SheetSeatingEntry> {
  const map = new Map<string, SheetSeatingEntry>();
  if (rows.length < 2) return map;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const groupName = String(r[0] ?? "").trim();
    const savedAt = String(r[1] ?? "").trim();
    const json = String(r[2] ?? "").trim();
    if (!groupName || !json) continue;
    try {
      map.set(groupName, {
        state: JSON.parse(json) as Record<string, unknown>,
        savedAt: savedAt || undefined,
      });
    } catch {
      console.warn(`  ⚠ 座位表「${groupName}」JSON 解析失敗，略過`);
    }
  }
  return map;
}

export async function fetchGvizSheet(
  spreadsheetId: string,
  sheetName: string,
): Promise<string[][]> {
  const url =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq` +
    `?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`讀取分頁「${sheetName}」失敗（HTTP ${res.status}）`);
  }
  return parseGvizResponse(await res.text());
}

export function resolveRosterSheets(
  onlySheet?: string,
  fromEnv?: string,
): string[] {
  if (onlySheet) return [onlySheet];
  const env = fromEnv?.trim();
  if (env) {
    return env.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_ROSTER_SHEETS;
}

export async function loadGroupsFromSpreadsheet(options?: {
  spreadsheetId?: string;
  rosterSheets?: string[];
  onlySheet?: string;
}): Promise<SheetGroupBundle[]> {
  const spreadsheetId = options?.spreadsheetId || DEFAULT_SPREADSHEET_ID;
  const rosterSheets = options?.rosterSheets?.length
    ? options.rosterSheets
    : resolveRosterSheets(options?.onlySheet, process.env.ROSTER_SHEETS);

  let seatingMap = new Map<string, SheetSeatingEntry>();
  try {
    const seatingRows = await fetchGvizSheet(spreadsheetId, "座位表");
    seatingMap = parseSeatingMap(seatingRows);
  } catch (err) {
    console.warn(
      "  ⚠ 無法讀取「座位表」：",
      err instanceof Error ? err.message : err,
    );
  }

  const bundles: SheetGroupBundle[] = [];

  for (const sheetName of rosterSheets) {
    const rows = await fetchGvizSheet(spreadsheetId, sheetName);
    bundles.push({
      sheetName,
      students: parseStudentsFromRows(rows, sheetName),
      seating: seatingMap.get(sheetName),
    });
  }

  return bundles;
}
