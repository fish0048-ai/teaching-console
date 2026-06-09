"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EnvBadge } from "./EnvBadge";

const NAV = [
  { href: "/", label: "儀表板", icon: "📊" },
  { href: "/homework", label: "作業表", icon: "📝" },
  { href: "/seating", label: "座位表", icon: "🪑" },
  { href: "/question-bank", label: "題庫管理", icon: "📚" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-slate-900 text-slate-100">
      <div className="border-b border-slate-700 px-4 py-5">
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-wider text-slate-400">
            Teaching Console
          </p>
          <EnvBadge />
        </div>
        <h1 className="mt-1 text-lg font-bold">教學主控台</h1>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-sky-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-700 p-3 text-xs text-slate-500">
        B 路線 · chunhsin-b2a9d
      </div>
    </aside>
  );
}
