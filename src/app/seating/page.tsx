import { DashboardShell } from "@/components/layout/DashboardShell";
import { SeatingBoard } from "@/components/seating/SeatingBoard";

export default function SeatingPage() {
  return (
    <DashboardShell
      title="座位表"
      subtitle="座位表置中 · 名單可於右側開關"
    >
      <SeatingBoard />
    </DashboardShell>
  );
}
