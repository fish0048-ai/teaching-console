import { DashboardShell } from "@/components/layout/DashboardShell";
import { QuestionBankPanel } from "@/components/question-bank/QuestionBankPanel";

export default function QuestionBankPage() {
  return (
    <DashboardShell title="題庫管理" subtitle="關鍵字篩選與 HTML 匯出">
      <QuestionBankPanel />
    </DashboardShell>
  );
}
