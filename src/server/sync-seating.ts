import { loadGroupsFromSpreadsheet } from "@/lib/sheets-roster";
import { getAdminFirestore } from "@/lib/firebase-admin-server";
import {
  importGroupsToFirestore,
  normalizeGroup,
  sheetNameToGroupId,
  type ImportGroup,
} from "../../scripts/lib/firestore-import";

export type SyncSeatingResult = {
  databaseId: string;
  groupCount: number;
  studentCount: number;
  seatingCount: number;
  groups: Array<{
    id: string;
    name: string;
    students: number;
    hasSeating: boolean;
    sheetLabel: string;
  }>;
};

function bundlesToImportGroups(
  bundles: Awaited<ReturnType<typeof loadGroupsFromSpreadsheet>>,
  onlyGroupId?: string,
): ImportGroup[] {
  const groups = bundles.map((b) =>
    normalizeGroup({
      id: sheetNameToGroupId(b.sheetName),
      name: b.sheetName.replace(/名單\s*$/, "") + " 名單",
      sheetLabel: b.sheetName,
      students: b.students,
      seating: b.seating?.state,
      seatingSavedAt: b.seating?.savedAt,
    }),
  );

  if (onlyGroupId) {
    return groups.filter((g) => g.id === onlyGroupId);
  }
  return groups;
}

/** 從 A 版試算表同步名單 + 座位表 → Firestore（需 Admin SDK） */
export async function syncRosterFromSheets(options?: {
  spreadsheetId?: string;
  onlySheet?: string;
  onlyGroupId?: string;
}): Promise<SyncSeatingResult> {
  const bundles = await loadGroupsFromSpreadsheet({
    spreadsheetId: options?.spreadsheetId,
    onlySheet: options?.onlySheet,
  });

  const groups = bundlesToImportGroups(bundles, options?.onlyGroupId);
  if (!groups.length) {
    throw new Error("找不到可同步的分組");
  }

  const { db, databaseId } = getAdminFirestore();
  const result = await importGroupsToFirestore(db, groups);

  return {
    databaseId,
    groupCount: result.groupCount,
    studentCount: result.studentCount,
    seatingCount: result.seatingCount,
    groups: result.groups.map((g) => {
      const src = groups.find((x) => x.id === g.id);
      return {
        ...g,
        sheetLabel: src?.sheetLabel ?? g.name,
      };
    }),
  };
}
