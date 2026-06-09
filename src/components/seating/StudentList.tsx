import type { Student } from "@/types";

type Props = {
  students: Student[];
  loading?: boolean;
  compact?: boolean;
  onClose?: () => void;
};

export function StudentList({
  students,
  loading,
  compact,
  onClose,
}: Props) {
  const wrapperClass = compact
    ? "flex h-full max-h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    : "overflow-hidden rounded-xl border border-slate-200 bg-white";

  if (loading) {
    return (
      <div className={`${wrapperClass} p-6 text-center text-sm text-slate-400`}>
        載入學生名單…
      </div>
    );
  }

  if (!students.length) {
    return (
      <div
        className={`${wrapperClass} px-4 py-8 text-center text-sm text-slate-500`}
      >
        此分組尚無學生資料
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">學生名單</h3>
          <p className="text-xs text-slate-400">共 {students.length} 人</p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="關閉名單"
          >
            ✕
          </button>
        ) : null}
      </div>
      <ul
        className={`divide-y divide-slate-100 ${compact ? "min-h-0 flex-1 overflow-y-auto" : ""}`}
      >
        {students.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-bold text-sky-700">
              {s.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">
                {s.name}
              </p>
              <p className="text-[11px] text-slate-400">
                {s.class} · #{s.number}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
