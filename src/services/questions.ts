import { collection, getDocs, limit, query } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type {
  Question,
  QuestionSearchFilter,
  QuestionSearchResult,
} from "@/types";

function mapQuestion(id: string, data: Record<string, unknown>): Question {
  return {
    id,
    subject: String(data.subject ?? ""),
    grade: String(data.grade ?? ""),
    unit: String(data.unit ?? ""),
    concept: data.concept ? String(data.concept) : undefined,
    type: String(data.type ?? ""),
    difficulty: String(data.difficulty ?? ""),
    stem: String(data.stem ?? ""),
    options: data.options as Question["options"],
    answer: data.answer ? String(data.answer) : undefined,
    explanation: data.explanation ? String(data.explanation) : undefined,
    source: data.source ? String(data.source) : undefined,
    reviewStatus: String(data.reviewStatus ?? "草稿"),
    tags: data.tags ? String(data.tags) : undefined,
  };
}

/** 題庫搜尋（只讀；大量資料後可改 Algolia / 索引） */
export async function searchQuestions(
  filter: QuestionSearchFilter = {},
): Promise<QuestionSearchResult> {
  const max = filter.limit ?? 50;
  const snap = await getDocs(
    query(collection(getDb(), "questions"), limit(500)),
  );

  let rows = snap.docs.map((d) => mapQuestion(d.id, d.data()));

  if (filter.reviewStatus) {
    rows = rows.filter((q) => q.reviewStatus === filter.reviewStatus);
  }

  if (filter.keyword) {
    const kw = filter.keyword.toLowerCase();
    rows = rows.filter((q) =>
      [q.stem, q.unit, q.tags, q.source, q.id]
        .join(" ")
        .toLowerCase()
        .includes(kw),
    );
  }

  return {
    count: rows.length,
    questions: rows.slice(0, max),
  };
}

export function renderQuestionsHtml(questions: Question[]): string {
  const parts = ['<div class="qb-export">'];
  questions.forEach((q, idx) => {
    parts.push(`<article class="qb-item" data-id="${escapeHtml(q.id)}">`);
    parts.push(
      `<header><span class="qb-no">${idx + 1}.</span> ` +
        `<span class="qb-meta">${escapeHtml(`${q.subject} · ${q.grade} · ${q.difficulty}`)}</span></header>`,
    );
    parts.push(`<p class="qb-stem">${escapeHtml(q.stem)}</p>`);
    (["A", "B", "C", "D", "E"] as const).forEach((l) => {
      const opt = q.options?.[l];
      if (opt) parts.push(`<p class="qb-opt">${l}. ${escapeHtml(opt)}</p>`);
    });
    if (q.answer) {
      parts.push(`<p class="qb-ans">答案：${escapeHtml(q.answer)}</p>`);
    }
    parts.push("</article>");
  });
  parts.push("</div>");
  return parts.join("\n");
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
