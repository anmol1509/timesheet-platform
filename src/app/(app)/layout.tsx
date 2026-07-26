import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { NavLinks } from "./nav-links";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white">
              TS
            </div>
            <span className="text-sm font-semibold whitespace-nowrap text-slate-900">
              Timesheet Platform
            </span>
          </Link>
          <div className="flex items-center gap-3">
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
          <div className="order-3 w-full overflow-x-auto">
            <NavLinks isAdmin={user.role === "ADMIN"} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
