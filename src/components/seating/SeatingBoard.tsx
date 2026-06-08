"use client";

import { useEffect, useMemo, useState } from "react";
import { getSeatingState } from "@/services/students";
import type { SeatingState, Student } from "@/types";
import { useGroups, useStudents } from "@/hooks/useStudents";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { LoadingBlock } from "@/components/ui/LoadingBlock";
import { StudentList } from "./StudentList";
import { StudentSeat } from "./StudentSeat";

function studentKey(s: Student) {
  return `${s.class}_${s.number}`;
}

export function SeatingBoard() {
  const { data: groups, loading: groupsLoading, error: groupsError, reload } =
    useGroups();
  const [groupId, setGroupId] = useState<string | null>(null);
  const {
    data: students,
    loading: studentsLoading,
    error: studentsError,
  } = useStudents(groupId);
  const [seating, setSeating] = useState<SeatingState | null>(null);

  useEffect(() => {
    if (groups?.length && !groupId) {
      setGroupId(groups[0]!.id);
    }
  }, [groups, groupId]);

  useEffect(() => {
    if (!groupId) return;
    getSeatingState(groupId)
      .then(setSeating)
      .catch(() => setSeating(null));
  }, [groupId]);

  const seatMap = useMemo(() => {
    if (!seating) return new Map<string, Student>();
    const map = new Map<string, Student>();
    const merge = (obj: Record<string, Omit<Student, "id">>) => {
      Object.entries(obj).forEach(([key, raw]) => {
        if (raw?.name) {
          map.set(key, {
            id: studentKey(raw as Student),
            ...raw,
          });
        }
      });
    };
    merge(seating.fixedSeats || {});
    merge(seating.draftFixedSeats || {});
    merge(seating.assignments || {});
    return map;
  }, [seating]);

  const blocked = useMemo(
    () => new Set(seating?.blocked || []),
    [seating?.blocked],
  );

  const rows = seating?.rows ?? 6;
  const cols = seating?.cols ?? 7;
  const loading = groupsLoading;
  const error = groupsError || studentsError;
  const displayError = error ? formatFirebaseError(new Error(error)) : null;

  if (loading && !groups) {
    return <LoadingBlock label="連線 Firebase…" />;
  }

  return (
    <div className="space-y-4">
      {displayError ? <ErrorBanner message={displayError} onRetry={reload} /> : null}

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-600">分組</label>
        <select
          value={groupId ?? ""}
          onChange={(e) => setGroupId(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {(groups ?? []).map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-amber-600">
          B 路線開發版 · 資料來自 Firestore（與 GAS 穩定版完全隔離）
        </p>
      </div>

      <StudentList students={students ?? []} loading={studentsLoading} />

      {seating && seatMap.size > 0 ? (
        <div
          className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: "0.5rem",
          }}
        >
          {Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => {
              const key = `${r},${c}`;
              if (blocked.has(key)) {
                return (
                  <div
                    key={key}
                    className="min-h-24 rounded-xl bg-slate-100"
                    aria-hidden
                  />
                );
              }
              const student = seatMap.get(key);
              if (!student) {
                return (
                  <div
                    key={key}
                    className="min-h-24 rounded-xl border border-dashed border-slate-200"
                  />
                );
              }
              return (
                <StudentSeat
                  key={key}
                  student={student}
                  disabled
                  onClick={undefined}
                />
              );
            }),
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400">
          座位配置尚未匯入 Firestore（可透過匯入腳本一併寫入 seating/state）
        </div>
      )}
    </div>
  );
}
