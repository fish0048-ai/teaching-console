import { collection, getCountFromServer, getDocs } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { DashboardStats } from "@/types";

/** 儀表板統計（只讀） */
export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getDb();

  const groupsSnap = await getDocs(collection(db, "groups"));
  const groupCount = groupsSnap.size;

  let studentCount = 0;
  for (const groupDoc of groupsSnap.docs) {
    const countSnap = await getCountFromServer(
      collection(db, "groups", groupDoc.id, "students"),
    );
    studentCount += countSnap.data().count;
  }

  const questionsSnap = await getCountFromServer(collection(db, "questions"));
  const questionTotal = questionsSnap.data().count;

  // 細分狀態可之後改為 aggregation；現階段先讀全量計數（小量資料）
  let questionApproved = 0;
  let questionPending = 0;
  if (questionTotal > 0 && questionTotal <= 500) {
    const all = await getDocs(collection(db, "questions"));
    all.docs.forEach((d) => {
      const st = String(d.data().reviewStatus ?? "");
      if (st === "已審") questionApproved++;
      else if (st === "待審") questionPending++;
    });
  }

  return {
    groupCount,
    studentCount,
    questionTotal,
    questionApproved,
    questionPending,
  };
}
