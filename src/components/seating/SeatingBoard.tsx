"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSeatingState } from "@/services/students";
import { syncSeatingFromSheets } from "@/services/seating-sync";
import type { SeatingState, Student } from "@/types";
import { useGroups, useStudents } from "@/hooks/useStudents";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { LoadingBlock } from "@/components/ui/LoadingBlock";
import { StudentList } from "./StudentList";
import { StudentSeat } from "./StudentSeat";

function studentKey(s: Pick<Student, "class" | "number">) {
  return `${s.class}_${s.number}`;
}

export function SeatingBoard() {
  const {
    data: groups,
    loading: groupsLoading,
    error: groupsError,
    reload: reloadGroups,
  } = useGroups();
  const [groupId, setGroupId] = useState<string | null>(null);
  const [showRoster, setShowRoster] = useState(true);
  const {
    data: students,
    loading: studentsLoading,
    error: studentsError,
    reload: reloadStudents,
  } = useStudents(groupId);
  const [seating, setSeating] = useState<SeatingState | null>(null);
  const [seatingLoading, setSeatingLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const selectedGroup = groups?.find((g) => g.id === groupId);

  useEffect(() => {
    if (groups?.length && !groupId) {
      setGroupId(groups[0]!.id);
    }
  }, [groups, groupId]);

  const loadSeating = useCallback(async () => {
    if (!groupId) return;
    setSeatingLoading(true);
    try {
      const data = await getSeatingState(groupId);
      setSeating(data);
    } catch {
      setSeating(null);
    } finally {
      setSeatingLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadSeating();
  }, [loadSeating]);

  const bonusByKey = useMemo(() => {
    const map = new Map<string, number>();
    (students ?? []).forEach((s) => {
      if (s.bonus != null && s.bonus > 0) {
        map.set(studentKey(s), s.bonus);
      }
    });
    return map;
  }, [students]);

  const seatMap = useMemo(() => {
    if (!seating) return new Map<string, Student>();
    const map = new Map<string, Student>();
    const merge = (obj: Record<string, Omit<Student, "id">>) => {
      Object.entries(obj).forEach(([key, raw]) => {
        if (raw?.name) {
          const id = studentKey(raw as Student);
          map.set(key, {
            id,
            ...raw,
            bonus: bonusByKey.get(id) ?? raw.bonus,
          });
        }
      });
    };
    merge(seating.fixedSeats || {});
    merge(seating.draftFixedSeats || {});
    merge(seating.assignments || {});
    return map;
  }, [seating, bonusByKey]);

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

  const handleSync = async (scope: "all" | "current") => {
    setSyncing(true);
    setSyncError(null);
    setSyncMessage(null);
    try {
      const result = await syncSeatingFromSheets(
        scope === "current" && groupId ? { groupId } : undefined,
      );
      const seatingPart = result.groups?.filter((g) => g.hasSeating).length ?? 0;
      setSyncMessage(
        `已同步 ${result.studentCount} 位學生 · ${seatingPart} 組含座位`,
      );
      await reloadGroups();
      await reloadStudents();
      await loadSeating();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  if (loading && !groups) {
    return <LoadingBlock label="連線 Firebase…" />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {displayError ? (
        <ErrorBanner message={displayError} onRetry={reloadGroups} />
      ) : null}
      {syncError ? <ErrorBanner message={syncError} /> : null}
      {syncMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {syncMessage}
        </div>
      ) : null}

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
          disabled={syncing}
          onClick={() => handleSync("current")}
          className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {syncing ? "同步中…" : "同步此分組"}
        </button>
        <button
          type="button"
          disabled={syncing}
          onClick={() => handleSync("all")}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-400 disabled:opacity-50"
        >
          同步全部分組
        </button>

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

        {seating?.savedAt || seating?.updatedAt ? (
          <span className="ml-auto text-xs text-slate-400">
            {seating.savedAt
              ? `試算表儲存：${seating.savedAt}`
              : `更新：${seating.updatedAt}`}
          </span>
        ) : null}
      </div>

      {selectedGroup?.sheetLabel ? (
        <p className="text-xs text-slate-400">
          資料來源試算表分頁：<strong>{selectedGroup.sheetLabel}</strong>
          {hasSeating ? null : " · 此分組在 A 版尚未儲存座位"}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          {seatingLoading && !seating ? (
            <LoadingBlock label="載入座位表…" />
          ) : hasSeating ? (
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
                          className="flex min-h-[5.5rem] items-center justify-center rounded-xl bg-slate-100 text-lg text-slate-300 sm:min-h-24"
                          aria-hidden
                        >
                          ✕
                        </div>
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
                        sheetBonus={student.bonus ?? bonusByKey.get(student.id)}
                        disabled
                      />
                    );
                  }),
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
              <p>此分組尚無座位配置</p>
              <p className="text-xs text-slate-400">
                請在 A 版 GAS 座位表產生並「儲存到試算表」後，按上方「同步此分組」
              </p>
              <button
                type="button"
                disabled={syncing}
                onClick={() => handleSync("current")}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {syncing ? "同步中…" : "從試算表同步"}
              </button>
            </div>
          )}
        </div>

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
