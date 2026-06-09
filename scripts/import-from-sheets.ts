/**
 * 從 Google 試算表匯入名單 + 座位表 → Firestore
 *
 * 試算表（A 版穩定版，唯讀）：
 *   https://docs.google.com/spreadsheets/d/1GzToDiDVuLfDZ4Y67BABloyaldCgqv1zwtoT7UNJnYs
 *
 * 前置：
 *   1. 將試算表「共用」給服務帳戶（檢視者即可）：
 *      firebase-adminsdk-fbsvc@chunhsin-b2a9d.iam.gserviceaccount.com
 *   2. .env.import 設定 SPREADSHEET_ID
 *
 * 使用：
 *   npm run import:sheets
 *   npm run import:sheets -- --sheet=801A名單
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { google } from "googleapis";
import {
  getServiceAccountPath,
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

/** 與 apps-script/Utils.gs detectHeaderRow 相同邏輯 */
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

async function createSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: getServiceAccountPath(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

async function fetchSheetValues(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetTitle: string,
  rangeCols = "A:E",
) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetTitle.replace(/'/g, "''")}'!${rangeCols}`,
  });
  return (res.data.values ?? []) as string[][];
}

async function listSheetTitles(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
) {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });
  return (
    meta.data.sheets
      ?.map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t)) ?? []
  );
}

async function loadFromSpreadsheet(
  spreadsheetId: string,
  onlySheet?: string,
): Promise<ImportGroup[]> {
  const sheets = await createSheetsClient();
  const titles = await listSheetTitles(sheets, spreadsheetId);

  let rosterSheets = titles.filter((t) => t.endsWith("名單"));
  if (onlySheet) {
    rosterSheets = rosterSheets.filter((t) => t === onlySheet);
    if (!rosterSheets.length) {
      throw new Error(`找不到名單分頁：${onlySheet}（現有：${titles.join("、")}）`);
    }
  }

  if (!rosterSheets.length) {
    throw new Error("試算表中沒有以「名單」結尾的分頁");
  }

  console.log(`名單分頁：${rosterSheets.join("、")}`);

  let seatingMap = new Map<string, Record<string, unknown>>();
  if (titles.includes("座位表")) {
    const seatingRows = await fetchSheetValues(
      sheets,
      spreadsheetId,
      "座位表",
      "A:C",
    );
    seatingMap = parseSeatingMap(seatingRows);
    console.log(`座位表：${seatingMap.size} 組已儲存配置`);
  } else {
    console.warn("  ⚠ 找不到「座位表」分頁，僅匯入學生名單");
  }

  const groups: ImportGroup[] = [];

  for (const sheetName of rosterSheets) {
    const rows = await fetchSheetValues(sheets, spreadsheetId, sheetName);
    const students = parseStudentsFromSheet(rows, sheetName);
    const seating = seatingMap.get(sheetName);

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
    source: `Google Sheets (${spreadsheetId})`,
    databaseId,
    ...result,
    questionCount: 0,
  });
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("\n匯入失敗：", msg);
  if (msg.includes("403") || msg.includes("permission")) {
    console.error(
      "\n請將試算表共用給：firebase-adminsdk-fbsvc@chunhsin-b2a9d.iam.gserviceaccount.com（檢視者）",
    );
  }
  process.exit(1);
});
