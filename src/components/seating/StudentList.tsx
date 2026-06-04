import type { Student } from "@/types";

type Props = {
  students: Student[];
  loading?: boolean;
};

export function StudentList({ students, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
        載入學生名單…
      </div>
    );
  }

  if (!students.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500">
        此分組尚無學生資料。請執行{" "}
        <code className="rounded bg-slate-100 px-1">npm run import:firestore</code>{" "}
        匯入測試資料。
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">
          學生名單（Firestore）
        </h3>
        <p className="text-xs text-slate-400">共 {students.length} 人 · 只讀模式</p>
      </div>
      <ul className="divide-y divide-slate-100">
        {students.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
              {s.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">
                {s.name}
              </p>
              <p className="text-xs text-slate-400">
                {s.class} · 座號 {s.number}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
