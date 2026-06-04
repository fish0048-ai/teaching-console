/**
 * Firestore 匯入腳本（一次性 / 本機執行）
 *
 * 用途：將試算表匯出的 JSON 寫入 Firebase 開發專案。
 * 注意：不會讀寫 GAS 或 Google Sheets 穩定版資料。
 *
 * 使用方式：
 *   1. Firebase Console → 專案設定 → 服務帳戶 → 產生新的私密金鑰
 *   2. 存為 scripts/service-account.json（已在 .gitignore）
 *   3. cp .env.import.example .env.import 並填入 FIREBASE_PROJECT_ID
 *   4. npm run import:firestore
 *   5. 可選：npm run import:firestore -- --file scripts/sample-data/import.json
 */

import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";

config({ path: resolve(process.cwd(), ".env.import") });

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

function studentDocId(s: ImportStudent) {
  return `${s.class}_${s.number}`.replace(/[/\\]/g, "-");
}

function initAdmin() {
  const projectId =
    process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    throw new Error("請在 .env.import 設定 FIREBASE_PROJECT_ID");
  }

  const keyPath =
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    resolve(process.cwd(), "scripts/service-account.json");

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(keyPath),
      projectId,
    });
  }

  const dbId = process.env.FIREBASE_DATABASE_ID || "chunhsindata";
  return getFirestore(getApp(), dbId);
}

async function importPayload(db: Firestore, payload: ImportPayload) {
  let groupCount = 0;
  let studentCount = 0;
  let questionCount = 0;

  for (const group of payload.groups) {
    const groupRef = db.collection("groups").doc(group.id);
    await groupRef.set(
      {
        name: group.name,
        sheetLabel: group.sheetLabel ?? group.name,
        studentCount: group.students.length,
        importedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    groupCount++;

    for (const s of group.students) {
      await groupRef
        .collection("students")
        .doc(studentDocId(s))
        .set(
          {
            group: s.group,
            class: s.class,
            number: String(s.number),
            name: s.name,
          },
          { merge: true },
        );
      studentCount++;
    }

    if (group.seating) {
      await groupRef
        .collection("seating")
        .doc("state")
        .set(
          {
            ...group.seating,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
    }
  }

  for (const q of payload.questions ?? []) {
    const id = String(q.id ?? "");
    if (!id) continue;
    await db
      .collection("questions")
      .doc(id)
      .set({ ...q, importedAt: FieldValue.serverTimestamp() }, { merge: true });
    questionCount++;
  }

  return { groupCount, studentCount, questionCount };
}

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  const file = fileArg
    ? fileArg.replace("--file=", "")
    : "scripts/sample-data/import.json";

  const abs = resolve(process.cwd(), file);
  console.log("讀取：", abs);

  const payload = JSON.parse(readFileSync(abs, "utf-8")) as ImportPayload;
  const db = initAdmin();
  const result = await importPayload(db, payload);

  console.log("匯入完成 ✓");
  console.log(`  分組：${result.groupCount}`);
  console.log(`  學生：${result.studentCount}`);
  console.log(`  題目：${result.questionCount}`);
}

main().catch((err) => {
  console.error("匯入失敗：", err);
  process.exit(1);
});
