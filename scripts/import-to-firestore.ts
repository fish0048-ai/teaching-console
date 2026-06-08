/**
 * Firestore 匯入腳本（一次性 / 本機執行）
 *
 * 預設讀取：scripts/sample-data/student-list.json（真實名單）
 * 完整匯入：npm run import:firestore -- --file=scripts/sample-data/import.json
 *
 * student-list.json 格式（擇一）：
 *   A) { "id", "name", "sheetLabel?", "students": [...] }
 *   B) { "groups": [ { "id", "name", "students": [...] } ] }
 */

import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  type DocumentReference,
  type Firestore,
} from "firebase-admin/firestore";

config({ path: resolve(process.cwd(), ".env.import") });

/** Firestore 單次 batch 上限 */
const BATCH_LIMIT = 500;

type ImportStudent = {
  group: string;
  class: string;
  number: string;
  name: string;
};

type ImportGroup = {
  id: string;
  name: string;
  sheetLabel?: string;
  students: ImportStudent[];
  seating?: Record<string, unknown>;
};

type ImportPayload = {
  groups: ImportGroup[];
  questions?: Record<string, unknown>[];
};

type StudentListFile = {
  id?: string;
  name?: string;
  sheetLabel?: string;
  students?: ImportStudent[];
  groups?: ImportGroup[];
  questions?: Record<string, unknown>[];
};

type ImportReport = {
  file: string;
  databaseId: string;
  groupCount: number;
  studentCount: number;
  skippedCount: number;
  batchCommits: number;
  questionCount: number;
  groups: Array<{ id: string; name: string; students: number }>;
};

function studentDocId(s: ImportStudent) {
  return `${s.class}_${s.number}`.replace(/[/\\#?[\]]/g, "-");
}

function slugGroupId(name: string) {
  return name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fff-]/g, "")
    .toLowerCase() || "group";
}

function normalizeStudent(raw: Record<string, unknown>): ImportStudent | null {
  const name = String(raw.name ?? "").trim();
  if (!name) return null;
  return {
    group: String(raw.group ?? "").trim(),
    class: String(raw.class ?? "").trim(),
    number: String(raw.number ?? "").trim(),
    name,
  };
}

/** 將 student-list.json 或 import.json 統一為 groups[] */
function parseInputFile(absPath: string): ImportPayload {
  const raw = JSON.parse(readFileSync(absPath, "utf-8")) as StudentListFile | ImportGroup[];

  if (Array.isArray(raw)) {
    throw new Error(
      "student-list.json 為陣列時請改用物件格式，並提供 id / name / students",
    );
  }

  if (raw.groups?.length) {
    return {
      groups: raw.groups.map(normalizeGroup),
      questions: raw.questions,
    };
  }

  if (raw.students?.length) {
    const id = raw.id || slugGroupId(raw.name || raw.sheetLabel || "students");
    const name = raw.name || raw.sheetLabel || id;
    return {
      groups: [
        normalizeGroup({
          id,
          name,
          sheetLabel: raw.sheetLabel ?? name,
          students: raw.students,
        }),
      ],
      questions: raw.questions,
    };
  }

  throw new Error("JSON 需包含 students[] 或 groups[]");
}

function normalizeGroup(g: ImportGroup): ImportGroup {
  const students: ImportStudent[] = [];
  let skipped = 0;
  for (const s of g.students ?? []) {
    const row = normalizeStudent(s as unknown as Record<string, unknown>);
    if (row) students.push(row);
    else skipped += 1;
  }
  if (skipped > 0) {
    console.warn(`  ⚠ 分組「${g.id}」略過 ${skipped} 筆（缺少姓名）`);
  }
  return {
    id: g.id,
    name: g.name,
    sheetLabel: g.sheetLabel ?? g.name,
    students,
    seating: g.seating,
  };
}

function initAdmin(): { db: Firestore; databaseId: string } {
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error("請在 .env.import 設定 FIREBASE_PROJECT_ID");
  }

  const keyPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    resolve(process.cwd(), "scripts/service-account.json");

  if (!existsSync(keyPath)) {
    throw new Error(`找不到服務帳戶金鑰：${keyPath}`);
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(keyPath),
      projectId,
    });
  }

  const databaseId =
    process.env.FIREBASE_DATABASE_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_ID ||
    "chunhsindata";

  return { db: getFirestore(getApp(), databaseId), databaseId };
}

/** 批次提交：每批最多 BATCH_LIMIT 個 set 操作，單批原子性 */
class BatchWriter {
  private batch: WriteBatch;
  private ops = 0;
  public commits = 0;

  constructor(private db: Firestore) {
    this.batch = db.batch();
  }

  set(
    ref: DocumentReference,
    data: Record<string, unknown>,
    merge = true,
  ) {
    this.batch.set(ref, data, { merge });
    this.ops++;
    if (this.ops >= BATCH_LIMIT) {
      return this.flush();
    }
    return Promise.resolve();
  }

  async flush() {
    if (this.ops === 0) return;
    await this.batch.commit();
    this.commits++;
    this.batch = this.db.batch();
    this.ops = 0;
  }
}

async function importGroups(
  db: Firestore,
  groups: ImportGroup[],
): Promise<Omit<ImportReport, "file" | "databaseId" | "questionCount">> {
  const writer = new BatchWriter(db);
  let studentCount = 0;
  let skippedCount = 0;
  const groupSummaries: ImportReport["groups"] = [];

  for (const group of groups) {
    const groupRef = db.collection("groups").doc(group.id);
    const validStudents: ImportStudent[] = [];

    for (const s of group.students) {
      const row = normalizeStudent(s as unknown as Record<string, unknown>);
      if (!row) {
        skippedCount++;
        continue;
      }
      validStudents.push(row);
    }

    await writer.set(groupRef, {
      name: group.name,
      sheetLabel: group.sheetLabel ?? group.name,
      studentCount: validStudents.length,
      importedAt: FieldValue.serverTimestamp(),
    });

    for (const s of validStudents) {
      const studentRef = groupRef.collection("students").doc(studentDocId(s));
      await writer.set(studentRef, {
        group: s.group,
        class: s.class,
        number: s.number,
        name: s.name,
        importedAt: FieldValue.serverTimestamp(),
      });
      studentCount++;
    }

    if (group.seating) {
      await writer.set(groupRef.collection("seating").doc("state"), {
        ...group.seating,
        updatedAt: new Date().toISOString(),
      });
    }

    groupSummaries.push({
      id: group.id,
      name: group.name,
      students: validStudents.length,
    });
  }

  await writer.flush();

  return {
    groupCount: groups.length,
    studentCount,
    skippedCount,
    batchCommits: writer.commits,
    groups: groupSummaries,
  };
}

async function importQuestions(
  db: Firestore,
  questions: Record<string, unknown>[],
) {
  const writer = new BatchWriter(db);
  let questionCount = 0;

  for (const q of questions) {
    const id = String(q.id ?? "");
    if (!id) continue;
    await writer.set(
      db.collection("questions").doc(id),
      { ...q, importedAt: FieldValue.serverTimestamp() },
    );
    questionCount++;
  }

  await writer.flush();
  return { questionCount, batchCommits: writer.commits };
}

function printReport(report: ImportReport) {
  console.log("\n══════════════════════════════════════");
  console.log("  Firestore 匯入報告");
  console.log("══════════════════════════════════════");
  console.log(`  檔案：     ${report.file}`);
  console.log(`  資料庫：   ${report.databaseId}`);
  console.log(`  分組數：   ${report.groupCount}`);
  console.log(`  學生總數： ${report.studentCount} 位`);
  if (report.skippedCount > 0) {
    console.log(`  略過：     ${report.skippedCount} 筆（無姓名）`);
  }
  console.log(`  Batch 提交：${report.batchCommits} 次`);
  if (report.questionCount > 0) {
    console.log(`  題目：     ${report.questionCount} 題`);
  }
  console.log("──────────────────────────────────────");
  for (const g of report.groups) {
    console.log(`  · ${g.name} (${g.id}) → ${g.students} 人`);
  }
  console.log("══════════════════════════════════════");
  console.log("  匯入完成 ✓\n");
}

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  const file = fileArg
    ? fileArg.replace("--file=", "")
    : "scripts/sample-data/student-list.json";

  const abs = resolve(process.cwd(), file);

  if (!existsSync(abs)) {
    throw new Error(
      `找不到檔案：${abs}\n請將真實名單存為 scripts/sample-data/student-list.json`,
    );
  }

  console.log("讀取：", abs);
  const payload = parseInputFile(abs);
  const { db, databaseId } = initAdmin();

  console.log(`目標資料庫：${databaseId}`);
  console.log(`待匯入分組：${payload.groups.length} 個`);

  const groupResult = await importGroups(db, payload.groups);

  let questionCount = 0;
  let extraBatches = 0;
  if (payload.questions?.length) {
    const qResult = await importQuestions(db, payload.questions);
    questionCount = qResult.questionCount;
    extraBatches = qResult.batchCommits;
  }

  printReport({
    file: abs,
    databaseId,
    ...groupResult,
    batchCommits: groupResult.batchCommits + extraBatches,
    questionCount,
  });
}

main().catch((err) => {
  console.error("\n匯入失敗：", err instanceof Error ? err.message : err);
  process.exit(1);
});
