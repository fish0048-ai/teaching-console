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
  const [showRoster, setShowRoster] = useState(true);
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
  const hasSeating = Boolean(seating && seatMap.size > 0);

  if (loading && !groups) {
    return <LoadingBlock label="連線 Firebase…" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {displayError ? <ErrorBanner message={displayError} onRetry={reload} /> : null}

      <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
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
        <button
          type="button"
          onClick={() => setShowRoster((v) => !v)}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
            showRoster
              ? "border-sky-200 bg-sky-50 text-sky-700"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {showRoster ? "隱藏名單" : "顯示名單"}
        </button>
        {students?.length ? (
          <span className="text-xs text-slate-400">{students.length} 人</span>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start">
        {/* 中央：座位表 */}
        <div className="min-w-0 flex-1">
          {hasSeating ? (
            <div className="mx-auto w-full max-w-3xl">
              <div className="mb-3 rounded-lg bg-slate-800 py-2 text-center text-xs font-semibold tracking-widest text-white">
                講 台
              </div>
              <div
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  gap: "0.375rem",
                }}
              >
                {Array.from({ length: rows }, (_, r) =>
                  Array.from({ length: cols }, (_, c) => {
                    const key = `${r},${c}`;
                    if (blocked.has(key)) {
                      return (
                        <div
                          key={key}
                          className="min-h-[5.5rem] rounded-xl bg-slate-100 sm:min-h-24"
                          aria-hidden
                        />
                      );
                    }
                    const student = seatMap.get(key);
                    if (!student) {
                      return (
                        <div
                          key={key}
                          className="min-h-[5.5rem] rounded-xl border border-dashed border-slate-200 sm:min-h-24"
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
            </div>
          ) : (
            <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-400">
              此分組尚無座位配置
              <br />
              <span className="mt-1 text-xs">
                請在 A 版儲存座位後執行 npm run import:sheets
              </span>
            </div>
          )}
        </div>

        {/* 右側：名單（可關閉） */}
        {showRoster ? (
          <aside className="w-full shrink-0 lg:w-72 xl:w-80">
            <StudentList
              students={students ?? []}
              loading={studentsLoading}
              compact
              onClose={() => setShowRoster(false)}
            />
          </aside>
        ) : null}
      </div>
    </div>
  );
}
