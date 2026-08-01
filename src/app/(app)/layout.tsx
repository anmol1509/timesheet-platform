import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { NavLinks } from "./nav-links";
import { MobileSidebar } from "./mobile-sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { getComplianceAlerts } from "@/lib/dashboardAlerts";
import { Bell } from "lucide-react";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || "")).toUpperCase() || "?";
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, alerts] = await Promise.all([requireUser(), getComplianceAlerts()]);

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-100 bg-white lg:fixed lg:inset-y-0 lg:flex">
        <Link href="/" className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-800 text-sm font-bold text-white shadow-sm">
            TS
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">ERP System</p>
            <p className="text-xs text-slate-400">Labor Management</p>
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <p className="px-3 pt-2 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
            Navigation
          </p>
          <NavLinks isAdmin={user.role === "ADMIN"} />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
            <MobileSidebar isAdmin={user.role === "ADMIN"} />
            <GlobalSearch />
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                className="relative rounded-full p-2.5 text-slate-500 hover:bg-slate-100"
              >
                <Bell className="h-5 w-5" />
                {alerts.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>
              <div className="hidden items-center gap-2.5 md:flex">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-800 text-xs font-semibold text-white">
                  {initials(user.name)}
                </div>
                <div className="text-sm leading-tight">
                  <p className="font-medium text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-400">{user.email}</p>
                </div>
              </div>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
