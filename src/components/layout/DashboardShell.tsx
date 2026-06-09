import { Sidebar } from "./Sidebar";

export function DashboardShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          ) : null}
        </header>
        <main className="flex min-h-0 flex-1 flex-col overflow-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
