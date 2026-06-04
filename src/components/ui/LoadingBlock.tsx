export function LoadingBlock({ label = "載入中…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-16 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
