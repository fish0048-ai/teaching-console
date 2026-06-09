import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { HomeworkAssignment, HomeworkState, Student } from "@/types";

export function studentRowKey(student: Pick<Student, "class" | "number">) {
  return `${student.class}_${student.number}`;
}

function homeworkRef(groupId: string) {
  return doc(getDb(), "groups", groupId, "homework", "state");
}

const emptyState = (): HomeworkState => ({
  assignments: [],
  submissions: {},
  updatedAt: new Date().toISOString(),
});

export async function getHomeworkState(
  groupId: string,
): Promise<HomeworkState> {
  const snap = await getDoc(homeworkRef(groupId));
  if (!snap.exists()) return emptyState();
  const data = snap.data();
  return {
    assignments: Array.isArray(data.assignments) ? data.assignments : [],
    submissions:
      data.submissions && typeof data.submissions === "object"
        ? (data.submissions as HomeworkState["submissions"])
        : {},
    updatedAt: String(data.updatedAt ?? ""),
  };
}

export async function saveHomeworkState(
  groupId: string,
  state: HomeworkState,
): Promise<void> {
  await setDoc(homeworkRef(groupId), {
    ...state,
    updatedAt: new Date().toISOString(),
  });
}

export function createAssignment(title: string, date?: string): HomeworkAssignment {
  const trimmed = title.trim();
  const id =
    trimmed.replace(/\s+/g, "-").slice(0, 40) +
    "-" +
    Date.now().toString(36);
  return {
    id,
    title: trimmed,
    date: date?.trim() || undefined,
    createdAt: new Date().toISOString(),
  };
}

export function isSubmitted(
  state: HomeworkState,
  studentKey: string,
  assignmentId: string,
): boolean {
  return Boolean(state.submissions[studentKey]?.[assignmentId]);
}

export function toggleSubmission(
  state: HomeworkState,
  studentKey: string,
  assignmentId: string,
): HomeworkState {
  const current = Boolean(state.submissions[studentKey]?.[assignmentId]);
  const row = { ...(state.submissions[studentKey] ?? {}) };
  if (current) delete row[assignmentId];
  else row[assignmentId] = true;

  const submissions = { ...state.submissions };
  if (Object.keys(row).length) submissions[studentKey] = row;
  else delete submissions[studentKey];

  return { ...state, submissions };
}

export function countSubmitted(
  state: HomeworkState,
  assignmentId: string,
  studentKeys: string[],
): number {
  return studentKeys.filter((key) => isSubmitted(state, key, assignmentId)).length;
}
