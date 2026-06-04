"use client";

import { useCallback, useState } from "react";
import {
  renderQuestionsHtml,
  searchQuestions,
} from "@/services/questions";
import type { Question } from "@/types";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { LoadingBlock } from "@/components/ui/LoadingBlock";

export function QuestionBankPanel() {
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [count, setCount] = useState(0);
  const [htmlExport, setHtmlExport] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildFilter = useCallback(() => {
    const filter: { keyword?: string; reviewStatus?: string; limit?: number } =
      { limit: 50 };
    if (keyword.trim()) filter.keyword = keyword.trim();
    if (status) filter.reviewStatus = status;
    return filter;
  }, [keyword, status]);

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setHtmlExport("");
    try {
      const res = await searchQuestions(buildFilter());
      setQuestions(res.questions);
      setCount(res.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "搜尋失敗");
    } finally {
      setLoading(false);
    }
  };

  const handleExportHtml = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await searchQuestions(buildFilter());
      setHtmlExport(renderQuestionsHtml(res.questions));
      setQuestions(res.questions);
      setCount(res.count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "匯出失敗");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error ? <ErrorBanner message={error} onRetry={handleSearch} /> : null}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="search"
            placeholder="關鍵字（題幹、標籤、來源…）"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">全部狀態</option>
            <option value="已審">已審</option>
            <option value="待審">待審</option>
            <option value="草稿">草稿</option>
          </select>
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={loading}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            搜尋
          </button>
          <button
            type="button"
            onClick={() => void handleExportHtml()}
            disabled={loading}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            匯出 HTML
          </button>
        </div>
      </div>

      {loading ? <LoadingBlock label="讀取 Firestore…" /> : null}

      {!loading && questions.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm text-slate-500">
            顯示 {questions.length} / 共 {count} 題
          </p>
          <div className="space-y-3">
            {questions.map((q) => (
              <article
                key={q.id}
                className="rounded-lg border border-slate-100 bg-slate-50 p-3"
              >
                <p className="text-xs text-slate-400">
                  {q.id} · {q.subject} · {q.difficulty} · {q.reviewStatus}
                </p>
                <p className="mt-1 text-sm font-medium text-slate-800">
                  {q.stem}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {htmlExport ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="mb-2 text-sm font-semibold text-slate-700">HTML 預覽</p>
          <div
            className="prose prose-sm max-w-none rounded-lg border border-slate-100 bg-slate-50 p-4"
            dangerouslySetInnerHTML={{ __html: htmlExport }}
          />
        </div>
      ) : null}
    </div>
  );
}
