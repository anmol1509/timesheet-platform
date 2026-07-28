import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { NavLinks } from "./nav-links";
import { Search, Bell } from "lucide-react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <aside className="flex w-64 shrink-0 flex-col bg-[#0B1642] lg:fixed lg:inset-y-0">
        <Link href="/" className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm font-bold text-[#0B1642]">
            TS
          </div>
          <div>
            <p className="text-sm font-semibold text-white">ERP System</p>
            <p className="text-xs text-slate-400">Labor Management</p>
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <p className="px-3 pt-2 pb-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            Navigation
          </p>
          <NavLinks isAdmin={user.role === "ADMIN"} />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search employees, projects, or documents..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm text-slate-700 outline-none focus:border-slate-400"
              />
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                <Bell className="h-5 w-5" />
              </button>
              <span className="hidden text-sm text-slate-500 md:inline">
                {user.name}
              </span>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
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
