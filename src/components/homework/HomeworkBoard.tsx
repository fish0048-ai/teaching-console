"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchHomeworkFromSheet } from "@/lib/sheets-gviz";
import { formatFirebaseError } from "@/lib/firebase-errors";
import { useGroups, useStudents } from "@/hooks/useStudents";
import type { HomeworkState, Student } from "@/types";
import {
  countSubmitted,
  createAssignment,
  getHomeworkState,
  isSubmitted,
  saveHomeworkState,
  studentRowKey,
  toggleSubmission,
} from "@/services/homework";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { LoadingBlock } from "@/components/ui/LoadingBlock";

export function HomeworkBoard() {
  const { data: groups, loading: groupsLoading, error: groupsError, reload } =
    useGroups();
  const [groupId, setGroupId] = useState<string | null>(null);
  const {
    data: students,
    loading: studentsLoading,
    error: studentsError,
  } = useStudents(groupId);

  const [hw, setHw] = useState<HomeworkState | null>(null);
  const [hwLoading, setHwLoading] = useState(false);
  const [hwError, setHwError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(
    null,
  );
  const [onlyMissing, setOnlyMissing] = useState(false);

  const selectedGroup = groups?.find((g) => g.id === groupId);

  useEffect(() => {
    if (groups?.length && !groupId) setGroupId(groups[0]!.id);
  }, [groups, groupId]);

  useEffect(() => {
    if (!groupId) return;
    setHwLoading(true);
    setHwError(null);
    getHomeworkState(groupId)
      .then(setHw)
      .catch((err) => setHwError(formatFirebaseError(err)))
      .finally(() => setHwLoading(false));
  }, [groupId]);

  useEffect(() => {
    if (hw?.assignments.length && !activeAssignmentId) {
      setActiveAssignmentId(hw.assignments[hw.assignments.length - 1]!.id);
    }
  }, [hw, activeAssignmentId]);

  const studentKeys = useMemo(
    () => (students ?? []).map((s) => studentRowKey(s)),
    [students],
  );

  const activeAssignment = hw?.assignments.find(
    (a) => a.id === activeAssignmentId,
  );

  const visibleStudents = useMemo(() => {
    if (!students?.length || !hw || !activeAssignmentId || !onlyMissing) {
      return students ?? [];
    }
    return students.filter(
      (s) => !isSubmitted(hw, studentRowKey(s), activeAssignmentId),
    );
  }, [students, hw, activeAssignmentId, onlyMissing]);

  const submittedCount = useMemo(() => {
    if (!hw || !activeAssignmentId) return 0;
    return countSubmitted(hw, activeAssignmentId, studentKeys);
  }, [hw, activeAssignmentId, studentKeys]);

  const persist = useCallback(
    async (next: HomeworkState) => {
      if (!groupId) return;
      setSaving(true);
      setHwError(null);
      try {
        await saveHomeworkState(groupId, next);
        setHw(next);
      } catch (err) {
        setHwError(formatFirebaseError(err));
      } finally {
        setSaving(false);
      }
    },
    [groupId],
  );

  const handleAddAssignment = async () => {
    if (!hw || !newTitle.trim()) return;
    const assignment = createAssignment(newTitle, newDate);
    const next: HomeworkState = {
      ...hw,
      assignments: [...hw.assignments, assignment],
    };
    await persist(next);
    setActiveAssignmentId(assignment.id);
    setNewTitle("");
    setNewDate("");
  };

  const handleToggle = async (student: Student, assignmentId: string) => {
    if (!hw) return;
    const next = toggleSubmission(hw, studentRowKey(student), assignmentId);
    await persist(next);
  };

  const handleSyncFromSheet = async () => {
    const sheetName = selectedGroup?.sheetLabel;
    if (!sheetName || !students?.length) return;

    setSyncing(true);
    setHwError(null);
    try {
      const sheetData = await fetchHomeworkFromSheet(sheetName);
      const base = hw ?? {
        assignments: [],
        submissions: {},
      };

      const existingTitles = new Set(base.assignments.map((a) => a.title));
      const addedAssignments = sheetData.columns
        .filter((c) => !existingTitles.has(c.title))
        .map((c) => createAssignment(c.title));

      const titleToId = new Map<string, string>();
      [...base.assignments, ...addedAssignments].forEach((a) => {
        titleToId.set(a.title, a.id);
      });

      const submissions = { ...base.submissions };
      for (const row of sheetData.rows) {
        const key = `${row.class}_${row.number}`;
        if (!students.some((s) => studentRowKey(s) === key)) continue;
        const cellMap = submissions[key] ?? {};
        for (const [title, done] of Object.entries(row.submissions)) {
          const id = titleToId.get(title);
          if (!id) continue;
          if (done) cellMap[id] = true;
          else delete cellMap[id];
        }
        if (Object.keys(cellMap).length) submissions[key] = cellMap;
        else delete submissions[key];
      }

      await persist({
        assignments: [...base.assignments, ...addedAssignments],
        submissions,
      });
    } catch (err) {
      setHwError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  const loading = groupsLoading || hwLoading;
  const error = groupsError || studentsError || hwError;

  if (loading && !groups) {
    return <LoadingBlock label="載入作業表…" />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {error ? (
        <ErrorBanner message={error} onRetry={reload} />
      ) : null}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">分組</span>
          <select
            value={groupId ?? ""}
            onChange={(e) => {
              setGroupId(e.target.value);
              setActiveAssignmentId(null);
            }}
            className="min-w-[160px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {(groups ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>

        {activeAssignment ? (
          <div className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900">
            <span className="font-semibold">{activeAssignment.title}</span>
            {activeAssignment.date ? (
              <span className="ml-2 text-sky-700">{activeAssignment.date}</span>
            ) : null}
            <span className="ml-3 text-sky-800">
              繳交 {submittedCount}/{studentKeys.length}
            </span>
          </div>
        ) : null}

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOnlyMissing((v) => !v)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              onlyMissing
                ? "bg-amber-100 text-amber-800"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            {onlyMissing ? "顯示全部" : "僅未交"}
          </button>
          <button
            type="button"
            disabled={!selectedGroup?.sheetLabel || syncing}
            onClick={handleSyncFromSheet}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-400 disabled:opacity-50"
          >
            {syncing ? "同步中…" : "從試算表同步"}
          </button>
          {saving ? (
            <span className="self-center text-xs text-slate-400">儲存中…</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">新增作業</span>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="例：3/15 1-1~1-2"
            className="min-w-[200px] rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">日期（選填）</span>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={!newTitle.trim() || saving}
          onClick={handleAddAssignment}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          新增欄位
        </button>
      </div>

      {!hw?.assignments.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          尚無作業欄位。請按「新增欄位」，或若試算表 F 欄起已有作業標題，可按「從試算表同步」。
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs text-slate-500">
                  <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2">班級</th>
                  <th className="sticky left-12 z-10 bg-slate-50 px-3 py-2">座號</th>
                  <th className="sticky left-24 z-10 min-w-[5rem] bg-slate-50 px-3 py-2">
                    姓名
                  </th>
                  {hw.assignments.map((a) => (
                    <th
                      key={a.id}
                      className={`min-w-[7rem] cursor-pointer px-2 py-2 text-center font-semibold ${
                        a.id === activeAssignmentId
                          ? "bg-sky-100 text-sky-900"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                      onClick={() => setActiveAssignmentId(a.id)}
                      title={a.date ?? undefined}
                    >
                      <div className="truncate">{a.title}</div>
                      {a.date ? (
                        <div className="text-[10px] font-normal text-slate-400">
                          {a.date}
                        </div>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {studentsLoading ? (
                  <tr>
                    <td
                      colSpan={3 + hw.assignments.length}
                      className="px-4 py-8 text-center text-slate-400"
                    >
                      載入學生…
                    </td>
                  </tr>
                ) : null}
                {!studentsLoading && !visibleStudents.length ? (
                  <tr>
                    <td
                      colSpan={3 + hw.assignments.length}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      {onlyMissing ? "此作業全班皆已繳交" : "此分組尚無學生"}
                    </td>
                  </tr>
                ) : null}
                {visibleStudents.map((s) => (
                  <StudentRow
                    key={s.id}
                    student={s}
                    assignments={hw.assignments}
                    hw={hw}
                    activeAssignmentId={activeAssignmentId}
                    onToggle={handleToggle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">
        點欄位標題可切換「目前作業」統計；點格子切換繳交狀態。資料存於 Firestore
        <code className="mx-1 rounded bg-slate-200 px-1">groups/…/homework/state</code>
        ，試算表 F 欄起的作業欄可用「從試算表同步」匯入。
      </p>
    </div>
  );
}

function StudentRow({
  student,
  assignments,
  hw,
  activeAssignmentId,
  onToggle,
}: {
  student: Student;
  assignments: HomeworkState["assignments"];
  hw: HomeworkState;
  activeAssignmentId: string | null;
  onToggle: (student: Student, assignmentId: string) => void;
}) {
  const key = studentRowKey(student);
  const rowHighlight =
    activeAssignmentId &&
    !isSubmitted(hw, key, activeAssignmentId);

  return (
    <tr
      className={`border-b border-slate-100 ${
        rowHighlight ? "bg-amber-50/60" : "hover:bg-slate-50/80"
      }`}
    >
      <td className="sticky left-0 z-[1] bg-inherit px-3 py-1.5 text-slate-600">
        {student.class}
      </td>
      <td className="sticky left-12 z-[1] bg-inherit px-3 py-1.5 text-slate-600">
        {student.number}
      </td>
      <td className="sticky left-24 z-[1] bg-inherit px-3 py-1.5 font-medium text-slate-800">
        {student.name}
      </td>
      {assignments.map((a) => {
        const done = isSubmitted(hw, key, a.id);
        return (
          <td key={a.id} className="px-1 py-1 text-center">
            <button
              type="button"
              onClick={() => onToggle(student, a.id)}
              className={`h-9 w-full min-w-[3rem] rounded-md border text-base font-bold transition ${
                done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "border-slate-200 bg-white text-slate-300 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600"
              }`}
              aria-label={`${student.name} ${a.title} ${done ? "已交" : "未交"}`}
            >
              {done ? "✓" : ""}
            </button>
          </td>
        );
      })}
    </tr>
  );
}
