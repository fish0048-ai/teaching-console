import type { Student } from "@/types";

function classColor(cls: string) {
  if (cls.includes("A") || cls.endsWith("甲")) return "bg-sky-100 text-sky-800 ring-sky-200";
  if (cls.includes("B") || cls.endsWith("乙")) return "bg-violet-100 text-violet-800 ring-violet-200";
  return "bg-emerald-100 text-emerald-800 ring-emerald-200";
}

type Props = {
  student: Student;
  bonusPoints?: number;
  disabled?: boolean;
  onClick?: () => void;
};

export function StudentSeat({
  student,
  bonusPoints = 0,
  disabled,
  onClick,
}: Props) {
  const initial = student.name.slice(0, 1) || "?";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`group relative flex w-full flex-col items-center gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${classColor(student.class)}`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-lg font-bold ring-2 ring-inset ring-white/60">
        {initial}
      </span>
      <span className="max-w-full truncate text-xs font-semibold">{student.name}</span>
      <span className="text-[10px] opacity-70">
        {student.class} · #{student.number}
      </span>
      {bonusPoints > 0 ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          +{bonusPoints}
        </span>
      ) : null}
    </button>
  );
}
