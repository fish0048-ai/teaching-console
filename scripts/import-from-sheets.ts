/**
 * 從 Google 試算表匯入名單 + 座位表 → Firestore
 *
 * 試算表（A 版，唯讀）：
 *   https://docs.google.com/spreadsheets/d/1GzToDiDVuLfDZ4Y67BABloyaldCgqv1zwtoT7UNJnYs
 *
 * 使用公開 gviz 匯出（不需啟用 Sheets API）：
 *   npm run import:sheets
 *   npm run import:sheets -- --sheet=801A名單
 *
 * 可選 .env.import：
 *   SPREADSHEET_ID=...
 *   ROSTER_SHEETS=801A名單,804A名單,806B名單
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import {
  importGroupsToFirestore,
  initAdmin,
  normalizeGroup,
  printImportReport,
  sheetNameToGroupId,
  type ImportGroup,
  type ImportStudent,
} from "./lib/firestore-import";

config({ path: resolve(process.cwd(), ".env.import") });

const DEFAULT_SPREADSHEET_ID = "1GzToDiDVuLfDZ4Y67BABloyaldCgqv1zwtoT7UNJnYs";
const DEFAULT_ROSTER_SHEETS = ["801A名單", "804A名單", "806B名單"];

function detectHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(4, rows.length); i++) {
    const textCount = rows[i].filter((v) => {
      if (v === "" || v == null) return false;
      return Number.isNaN(Number(String(v).trim()));
    }).length;
    if (textCount >= 3) return i;
  }
  return 0;
}

function parseStudentsFromSheet(
  rows: string[][],
  sheetName: string,
): ImportStudent[] {
  if (rows.length < 2) return [];

  const headerIdx = detectHeaderRow(rows);
  const students: ImportStudent[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const name = String(r[3] ?? "").trim();
    if (!name) continue;
    students.push({
      group: String(r[0] ?? "").trim(),
      class: String(r[1] ?? "").trim(),
      number: String(r[2] ?? "").trim(),
      name,
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

function parseSeatingMap(
  rows: string[][],
): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  if (rows.length < 2) return map;

  for (let i = 1; i < rows.length; i++) {
    const groupName = String(rows[i][0] ?? "").trim();
    const json = String(rows[i][2] ?? "").trim();
    if (!groupName || !json) continue;
    try {
      map.set(groupName, JSON.parse(json) as Record<string, unknown>);
    } catch {
      console.warn(`  ⚠ 座位表「${groupName}」JSON 解析失敗，略過`);
    }
  }
  return map;
}

function cellValue(cell: { v?: unknown; f?: string } | null): string {
  if (!cell || cell.v == null || cell.v === "") return "";
  if (typeof cell.v === "string") return cell.v;
  if (typeof cell.v === "number") return String(cell.v);
  return String(cell.f ?? cell.v);
}

function parseGvizResponse(text: string): string[][] {
  const match = text.match(/setResponse\(([\s\S]+)\)\s*;?\s*$/);
  if (!match) throw new Error("無法解析試算表 gviz 回應");
  const payload = JSON.parse(match[1]) as {
    table?: { rows?: Array<{ c?: Array<{ v?: unknown; f?: string } | null> }> };
  };
  return (payload.table?.rows ?? []).map((row) =>
    (row.c ?? []).map((cell) => cellValue(cell)),
  );
}

async function fetchGvizSheet(
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

function resolveRosterSheets(onlySheet?: string): string[] {
  if (onlySheet) return [onlySheet];

  const fromEnv = process.env.ROSTER_SHEETS?.trim();
  if (fromEnv) {
    return fromEnv.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_ROSTER_SHEETS;
}

async function loadFromSpreadsheet(
  spreadsheetId: string,
  onlySheet?: string,
): Promise<ImportGroup[]> {
  const rosterSheets = resolveRosterSheets(onlySheet);
  console.log(`名單分頁：${rosterSheets.join("、")}`);
  console.log("讀取方式：試算表公開 gviz 匯出（唯讀）");

  let seatingMap = new Map<string, Record<string, unknown>>();
  try {
    const seatingRows = await fetchGvizSheet(spreadsheetId, "座位表");
    seatingMap = parseSeatingMap(seatingRows);
    console.log(`座位表：${seatingMap.size} 組已儲存配置`);
  } catch (err) {
    console.warn(
      "  ⚠ 無法讀取「座位表」：",
      err instanceof Error ? err.message : err,
    );
  }

  const groups: ImportGroup[] = [];

  for (const sheetName of rosterSheets) {
    console.log(`  → 讀取 ${sheetName}…`);
    const rows = await fetchGvizSheet(spreadsheetId, sheetName);
    const students = parseStudentsFromSheet(rows, sheetName);
    const seating = seatingMap.get(sheetName);

    if (seating) {
      console.log(`     ✓ 含座位配置`);
    } else {
      console.log(`     · 無座位配置（名單仍會匯入）`);
    }

    groups.push(
      normalizeGroup({
        id: sheetNameToGroupId(sheetName),
        name: sheetName.replace(/名單\s*$/, "") + " 名單",
        sheetLabel: sheetName,
        students,
        seating,
      }),
    );
  }

  return groups;
}

async function main() {
  const spreadsheetId =
    process.env.SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
  const sheetArg = process.argv.find((a) => a.startsWith("--sheet="));
  const onlySheet = sheetArg?.replace("--sheet=", "");

  console.log("試算表 ID：", spreadsheetId);
  if (onlySheet) console.log("僅匯入分頁：", onlySheet);

  const groups = await loadFromSpreadsheet(spreadsheetId, onlySheet);
  const { db, databaseId } = initAdmin();

  console.log(`\n目標 Firestore：${databaseId}`);
  console.log(`待寫入分組：${groups.length} 個\n`);

  const result = await importGroupsToFirestore(db, groups);

  printImportReport({
    source: `Google Sheets gviz (${spreadsheetId})`,
    databaseId,
    ...result,
    questionCount: 0,
  });
}

main().catch((err) => {
  console.error("\n匯入失敗：", err instanceof Error ? err.message : err);
  process.exit(1);
});
