import type { Student } from "@/types";
import { classColorClasses } from "@/lib/class-colors";

type Props = {
  student: Student;
  sheetBonus?: number;
  sessionBonus?: number;
  disabled?: boolean;
  onClick?: () => void;
};

export function StudentSeat({
  student,
  sheetBonus = 0,
  sessionBonus = 0,
  disabled,
  onClick,
}: Props) {
  const initial = student.name.slice(0, 1) || "?";
  const totalBonus = sheetBonus + sessionBonus;
  const color = classColorClasses(student.class);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative flex w-full flex-col items-center gap-1 rounded-xl border border-slate-200 p-2 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md active:scale-95 disabled:cursor-default disabled:opacity-100 disabled:hover:translate-y-0 disabled:hover:shadow-sm ${color} ${onClick ? "" : "cursor-default"}`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-lg font-bold ring-2 ring-inset ring-white/60">
        {initial}
      </span>
      <span className="max-w-full truncate text-xs font-semibold">{student.name}</span>
      <span className="text-[10px] opacity-70">
        {student.class} · #{student.number}
      </span>
      {totalBonus > 0 ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          +{totalBonus}
        </span>
      ) : null}
    </button>
  );
}
