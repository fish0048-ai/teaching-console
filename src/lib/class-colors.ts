const PALETTES = [
  {
    bg: "bg-indigo-100",
    text: "text-indigo-800",
    ring: "ring-indigo-200",
  },
  {
    bg: "bg-violet-100",
    text: "text-violet-800",
    ring: "ring-violet-200",
  },
  {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    ring: "ring-emerald-200",
  },
  {
    bg: "bg-amber-100",
    text: "text-amber-800",
    ring: "ring-amber-200",
  },
  {
    bg: "bg-rose-100",
    text: "text-rose-800",
    ring: "ring-rose-200",
  },
  {
    bg: "bg-cyan-100",
    text: "text-cyan-800",
    ring: "ring-cyan-200",
  },
] as const;

/** 與 A 版 clsToken 相同：依班級號碼固定配色 */
export function classColorIndex(cls: string): number {
  const digits = String(cls).replace(/\D/g, "");
  if (digits) return parseInt(digits, 10) % PALETTES.length;
  let idx = 0;
  for (const ch of String(cls)) {
    idx = (idx + ch.charCodeAt(0)) % PALETTES.length;
  }
  return idx;
}

export function classColorClasses(cls: string): string {
  const p = PALETTES[classColorIndex(cls)]!;
  return `${p.bg} ${p.text} ring-1 ${p.ring}`;
}
