"use client";

import { useEffect, useState } from "react";
import { getDashboardStats } from "@/services/dashboard";
import type { DashboardStats } from "@/types";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { LoadingBlock } from "@/components/ui/LoadingBlock";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getDashboardStats()
      .then(setData)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "載入失敗"),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell
      title="儀表板"
      subtitle="Firebase 開發版 · 與 GAS 穩定版完全隔離"
    >
      {loading ? <LoadingBlock label="讀取 Firestore 統計…" /> : null}
      {error ? <ErrorBanner message={error} /> : null}
      {data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <StatCard
            title="座位表 / 分組"
            ok={data.groupCount > 0}
            lines={[
              `分組數：${data.groupCount}`,
              `學生總數：${data.studentCount}`,
            ]}
          />
          <StatCard
            title="題庫"
            ok={data.questionTotal >= 0}
            lines={[
              `總題數：${data.questionTotal}`,
              `已審 ${data.questionApproved} · 待審 ${data.questionPending}`,
            ]}
          />
        </div>
      ) : null}
    </DashboardShell>
  );
}

function StatCard({
  title,
  ok,
  lines,
}: {
  title: string;
  ok: boolean;
  lines: string[];
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900">{title}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {ok ? "有資料" : "待匯入"}
        </span>
      </div>
      <ul className="mt-3 space-y-1 text-sm text-slate-600">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
