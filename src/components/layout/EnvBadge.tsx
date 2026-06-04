import { getAppEnv } from "@/lib/env";

export function EnvBadge() {
  const env = getAppEnv();
  const isDev = env === "development";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isDev
          ? "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40"
          : "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
      }`}
    >
      {isDev ? "DEV · Firebase" : "PROD · Firebase"}
    </span>
  );
}
