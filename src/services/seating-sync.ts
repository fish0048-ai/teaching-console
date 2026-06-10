export type SyncSeatingResponse = {
  ok: boolean;
  error?: string;
  databaseId?: string;
  groupCount?: number;
  studentCount?: number;
  seatingCount?: number;
  groups?: Array<{
    id: string;
    name: string;
    students: number;
    hasSeating: boolean;
    sheetLabel: string;
  }>;
};

export async function syncSeatingFromSheets(options?: {
  groupId?: string;
  sheet?: string;
}): Promise<SyncSeatingResponse> {
  const res = await fetch("/api/sync/seating", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });

  const data = (await res.json()) as SyncSeatingResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `同步失敗（HTTP ${res.status}）`);
  }
  return data;
}
