import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  type DocumentReference,
  type Firestore,
  type WriteBatch,
} from "firebase-admin/firestore";

export const BATCH_LIMIT = 500;

export type ImportStudent = {
  group: string;
  class: string;
  number: string;
  name: string;
};

export type ImportGroup = {
  id: string;
  name: string;
  sheetLabel?: string;
  students: ImportStudent[];
  seating?: Record<string, unknown>;
};

export type ImportReport = {
  source: string;
  databaseId: string;
  groupCount: number;
  studentCount: number;
  seatingCount: number;
  skippedCount: number;
  batchCommits: number;
  questionCount: number;
  groups: Array<{
    id: string;
    name: string;
    students: number;
    hasSeating: boolean;
  }>;
};

export function studentDocId(s: ImportStudent) {
  return `${s.class}_${s.number}`.replace(/[/\\#?[\]]/g, "-");
}

export function slugGroupId(name: string) {
  return (
    name
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u4e00-\u9fff-]/g, "")
      .toLowerCase() || "group"
  );
}

/** 試算表分頁名稱 → Firestore group id，例：801A名單 → 801a-mingdan */
export function sheetNameToGroupId(sheetName: string) {
  const base = sheetName.replace(/名單\s*$/, "").trim();
  return slugGroupId(`${base}-mingdan`);
}

export function normalizeStudent(
  raw: Record<string, unknown>,
): ImportStudent | null {
  const name = String(raw.name ?? "").trim();
  if (!name) return null;
  return {
    group: String(raw.group ?? "").trim(),
    class: String(raw.class ?? "").trim(),
    number: String(raw.number ?? "").trim(),
    name,
  };
}

export function normalizeGroup(g: ImportGroup): ImportGroup {
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

export function getServiceAccountPath() {
  return (
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    resolve(process.cwd(), "scripts/service-account.json")
  );
}

export function initAdmin(): { db: Firestore; databaseId: string } {
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error("請在 .env.import 設定 FIREBASE_PROJECT_ID");
  }

  const keyPath = getServiceAccountPath();
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

class BatchWriter {
  private batch: WriteBatch;
  private ops = 0;
  public commits = 0;

  constructor(private db: Firestore) {
    this.batch = db.batch();
  }

  async set(
    ref: DocumentReference,
    data: Record<string, unknown>,
    merge = true,
  ) {
    this.batch.set(ref, data, { merge });
    this.ops++;
    if (this.ops >= BATCH_LIMIT) {
      await this.flush();
    }
  }

  async flush() {
    if (this.ops === 0) return;
    await this.batch.commit();
    this.commits++;
    this.batch = this.db.batch();
    this.ops = 0;
  }
}

export async function importGroupsToFirestore(
  db: Firestore,
  groups: ImportGroup[],
): Promise<Omit<ImportReport, "source" | "databaseId" | "questionCount">> {
  const writer = new BatchWriter(db);
  let studentCount = 0;
  let skippedCount = 0;
  let seatingCount = 0;
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
      await writer.set(groupRef.collection("students").doc(studentDocId(s)), {
        group: s.group,
        class: s.class,
        number: s.number,
        name: s.name,
        importedAt: FieldValue.serverTimestamp(),
      });
      studentCount++;
    }

    const hasSeating = Boolean(group.seating);
    if (group.seating) {
      await writer.set(groupRef.collection("seating").doc("state"), {
        ...group.seating,
        updatedAt: new Date().toISOString(),
      });
      seatingCount++;
    }

    groupSummaries.push({
      id: group.id,
      name: group.name,
      students: validStudents.length,
      hasSeating,
    });
  }

  await writer.flush();

  return {
    groupCount: groups.length,
    studentCount,
    seatingCount,
    skippedCount,
    batchCommits: writer.commits,
    groups: groupSummaries,
  };
}

export async function importQuestionsToFirestore(
  db: Firestore,
  questions: Record<string, unknown>[],
) {
  const writer = new BatchWriter(db);
  let questionCount = 0;

  for (const q of questions) {
    const id = String(q.id ?? "");
    if (!id) continue;
    await writer.set(db.collection("questions").doc(id), {
      ...q,
      importedAt: FieldValue.serverTimestamp(),
    });
    questionCount++;
  }

  await writer.flush();
  return { questionCount, batchCommits: writer.commits };
}

export function printImportReport(report: ImportReport) {
  console.log("\n══════════════════════════════════════");
  console.log("  Firestore 匯入報告");
  console.log("══════════════════════════════════════");
  console.log(`  來源：     ${report.source}`);
  console.log(`  資料庫：   ${report.databaseId}`);
  console.log(`  分組數：   ${report.groupCount}`);
  console.log(`  學生總數： ${report.studentCount} 位`);
  console.log(`  座位表：   ${report.seatingCount} 組`);
  if (report.skippedCount > 0) {
    console.log(`  略過：     ${report.skippedCount} 筆（無姓名）`);
  }
  console.log(`  Batch 提交：${report.batchCommits} 次`);
  if (report.questionCount > 0) {
    console.log(`  題目：     ${report.questionCount} 題`);
  }
  console.log("──────────────────────────────────────");
  for (const g of report.groups) {
    const seat = g.hasSeating ? "含座位" : "無座位";
    console.log(`  · ${g.name} (${g.id}) → ${g.students} 人，${seat}`);
  }
  console.log("══════════════════════════════════════");
  console.log("  匯入完成 ✓\n");
}
