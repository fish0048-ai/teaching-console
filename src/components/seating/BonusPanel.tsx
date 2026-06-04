"use client";

import type { Student } from "@/types";

type Props = {
  student: Student;
  sessionBonus: number;
  saving: boolean;
  onAdjust: (delta: number) => void;
  onClose: () => void;
};

export function BonusPanel({
  student,
  sessionBonus,
  saving,
  onAdjust,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              快速加分
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{student.name}</h3>
            <p className="text-sm text-slate-500">
              {student.class} · 座號 {student.number}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          本堂累計：<strong>+{sessionBonus}</strong> 分
        </p>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {[1, 2, 3, 5].map((pts) => (
            <button
              key={pts}
              type="button"
              disabled={saving}
              onClick={() => onAdjust(pts)}
              className="rounded-xl bg-sky-600 py-3 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              +{pts}
            </button>
          ))}
          <button
            type="button"
            disabled={saving || sessionBonus <= 0}
            onClick={() => onAdjust(-1)}
            className="rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            −1
          </button>
        </div>

        {saving ? (
          <p className="mt-3 text-center text-xs text-slate-400">寫入試算表中…</p>
        ) : null}
      </div>
    </div>
  );
}
