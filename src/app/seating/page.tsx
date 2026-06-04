import { DashboardShell } from "@/components/layout/DashboardShell";
import { SeatingBoard } from "@/components/seating/SeatingBoard";

export default function SeatingPage() {
  return (
    <DashboardShell
      title="座位表"
      subtitle="從 Firestore 讀取學生名單（只讀）"
    >
      <SeatingBoard />
    </DashboardShell>
  );
}
