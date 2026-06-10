import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { Group, SeatingState, Student } from "@/types";

function mapStudentDoc(id: string, data: Record<string, unknown>): Student {
  const bonusRaw = data.bonus;
  const bonus =
    bonusRaw != null && bonusRaw !== "" && !Number.isNaN(Number(bonusRaw))
      ? Number(bonusRaw)
      : undefined;

  return {
    id,
    group: String(data.group ?? ""),
    class: String(data.class ?? ""),
    number: String(data.number ?? ""),
    name: String(data.name ?? ""),
    bonus,
  };
}

/** 讀取所有分組 */
export async function listGroups(): Promise<Group[]> {
  const snap = await getDocs(collection(getDb(), "groups"));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: String(data.name ?? d.id),
      sheetLabel: data.sheetLabel ? String(data.sheetLabel) : undefined,
      studentCount:
        typeof data.studentCount === "number" ? data.studentCount : undefined,
    };
  });
}

/** 讀取指定分組的學生名單（依班級、座號排序） */
export async function getStudentsByGroup(groupId: string): Promise<Student[]> {
  const snap = await getDocs(
    collection(getDb(), "groups", groupId, "students"),
  );
  return snap.docs
    .map((d) => mapStudentDoc(d.id, d.data()))
    .filter((s) => s.name)
    .sort(
      (a, b) =>
        a.class.localeCompare(b.class, "zh-TW") ||
        Number(a.number) - Number(b.number),
    );
}

/** 讀取座位狀態（若存在） */
export async function getSeatingState(
  groupId: string,
): Promise<SeatingState | null> {
  const ref = doc(getDb(), "groups", groupId, "seating", "state");
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as SeatingState;
}
