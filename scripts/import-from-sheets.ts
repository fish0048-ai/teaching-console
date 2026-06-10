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
  DEFAULT_SPREADSHEET_ID,
  loadGroupsFromSpreadsheet,
} from "../src/lib/sheets-roster";
import {
  importGroupsToFirestore,
  initAdmin,
  normalizeGroup,
  printImportReport,
  sheetNameToGroupId,
  type ImportGroup,
} from "./lib/firestore-import";

config({ path: resolve(process.cwd(), ".env.import") });

function bundlesToImportGroups(
  bundles: Awaited<ReturnType<typeof loadGroupsFromSpreadsheet>>,
): ImportGroup[] {
  return bundles.map((b) =>
    normalizeGroup({
      id: sheetNameToGroupId(b.sheetName),
      name: b.sheetName.replace(/名單\s*$/, "") + " 名單",
      sheetLabel: b.sheetName,
      students: b.students,
      seating: b.seating?.state,
      seatingSavedAt: b.seating?.savedAt,
    }),
  );
}

async function main() {
  const spreadsheetId =
    process.env.SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
  const sheetArg = process.argv.find((a) => a.startsWith("--sheet="));
  const onlySheet = sheetArg?.replace("--sheet=", "");

  console.log("試算表 ID：", spreadsheetId);
  if (onlySheet) console.log("僅匯入分頁：", onlySheet);
  console.log("讀取方式：試算表公開 gviz 匯出（唯讀）");

  const bundles = await loadGroupsFromSpreadsheet({
    spreadsheetId,
    onlySheet,
  });

  for (const b of bundles) {
    console.log(`  → ${b.sheetName}：${b.students.length} 人${b.seating ? "，含座位" : ""}`);
  }

  const groups = bundlesToImportGroups(bundles);
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
