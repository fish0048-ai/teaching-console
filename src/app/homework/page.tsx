import { DashboardShell } from "@/components/layout/DashboardShell";
import { HomeworkBoard } from "@/components/homework/HomeworkBoard";

export default function HomeworkPage() {
  return (
    <DashboardShell
      title="作業表"
      subtitle="學生 × 作業繳交矩陣 · 可同步試算表 F 欄起的作業欄"
    >
      <HomeworkBoard />
    </DashboardShell>
  );
}
