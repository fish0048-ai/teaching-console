const DEFAULT_SPREADSHEET_ID =
  process.env.NEXT_PUBLIC_ROSTER_SPREADSHEET_ID ||
  "1GzToDiDVuLfDZ4Y67BABloyaldCgqv1zwtoT7UNJnYs";

function cellValue(cell: { v?: unknown; f?: string } | null): string {
  if (!cell || cell.v == null || cell.v === "") return "";
  if (typeof cell.v === "string") return cell.v.trim();
  if (typeof cell.v === "number") return String(cell.v);
  return String(cell.f ?? cell.v).trim();
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

function detectHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(4, rows.length); i++) {
    const joined = (rows[i] ?? []).join("|");
    if (joined.includes("姓名") && joined.includes("座號")) return i;
  }
  return 0;
}

export type SheetHomeworkColumn = {
  colIndex: number;
  title: string;
};

export type SheetHomeworkRow = {
  class: string;
  number: string;
  name: string;
  submissions: Record<string, boolean>;
};

export type SheetHomeworkData = {
  columns: SheetHomeworkColumn[];
  rows: SheetHomeworkRow[];
};

/** 從名單分頁 F 欄起讀取作業欄（標題列 + 繳交標記） */
export async function fetchHomeworkFromSheet(
  sheetName: string,
  spreadsheetId = DEFAULT_SPREADSHEET_ID,
): Promise<SheetHomeworkData> {
  const url =
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq` +
    `?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`讀取分頁「${sheetName}」失敗（HTTP ${res.status}）`);
  }

  const rows = parseGvizResponse(await res.text());
  if (rows.length < 2) {
    return { columns: [], rows: [] };
  }

  const headerIdx = detectHeaderRow(rows);
  const header = rows[headerIdx] ?? [];
  const baseCols = 5; // A~E：分組、班級、座號、姓名、加分

  const columns: SheetHomeworkColumn[] = [];
  for (let c = baseCols; c < header.length; c++) {
    const title = String(header[c] ?? "").trim();
    if (!title) continue;
    columns.push({ colIndex: c, title });
  }

  const dataRows: SheetHomeworkRow[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const name = String(r[3] ?? "").trim();
    if (!name) continue;

    const submissions: Record<string, boolean> = {};
    for (const col of columns) {
      const val = String(r[col.colIndex] ?? "").trim();
      submissions[col.title] = isSubmittedCell(val);
    }

    dataRows.push({
      class: String(r[1] ?? "").trim(),
      number: String(r[2] ?? "").trim(),
      name,
      submissions,
    });
  }

  return { columns, rows: dataRows };
}

function isSubmittedCell(val: string): boolean {
  if (!val) return false;
  const lower = val.toLowerCase();
  if (["v", "✓", "✔", "y", "yes", "是", "已交", "交"].includes(lower)) {
    return true;
  }
  const n = Number(val);
  return Number.isFinite(n) && n > 0;
}
