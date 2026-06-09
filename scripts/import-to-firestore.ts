/**
 * 從 JSON 匯入 Firestore
 * 預設：scripts/sample-data/student-list.json
 */

import { config } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  importGroupsToFirestore,
  importQuestionsToFirestore,
  initAdmin,
  normalizeGroup,
  printImportReport,
  slugGroupId,
  type ImportGroup,
} from "./lib/firestore-import";

config({ path: resolve(process.cwd(), ".env.import") });

type StudentListFile = {
  id?: string;
  name?: string;
  sheetLabel?: string;
  students?: ImportGroup["students"];
  groups?: ImportGroup[];
  questions?: Record<string, unknown>[];
};

function parseInputFile(absPath: string) {
  const raw = JSON.parse(readFileSync(absPath, "utf-8")) as StudentListFile;

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

async function main() {
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  const file = fileArg
    ? fileArg.replace("--file=", "")
    : "scripts/sample-data/student-list.json";

  const abs = resolve(process.cwd(), file);
  if (!existsSync(abs)) {
    throw new Error(`找不到檔案：${abs}`);
  }

  console.log("讀取：", abs);
  const payload = parseInputFile(abs);
  const { db, databaseId } = initAdmin();

  const groupResult = await importGroupsToFirestore(db, payload.groups);

  let questionCount = 0;
  let extraBatches = 0;
  if (payload.questions?.length) {
    const qResult = await importQuestionsToFirestore(db, payload.questions);
    questionCount = qResult.questionCount;
    extraBatches = qResult.batchCommits;
  }

  printImportReport({
    source: abs,
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
