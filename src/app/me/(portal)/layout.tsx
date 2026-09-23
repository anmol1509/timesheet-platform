import { redirect } from "next/navigation";
import { getEssEmployee } from "@/lib/ess/session";
import { PortalNav } from "./portal-nav";
import { essSignOutAction } from "./actions";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const employee = await getEssEmployee();
  if (!employee) redirect("/me/login");

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 border-b border-default bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {employee.branch.logoId && (
              // eslint-disable-next-line @next/next/no-img-element -- served by our own /me/logo route
              <img src="/me/logo" alt="" className="h-8 w-8 shrink-0 rounded-md object-contain" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-primary">{employee.branch.name}</p>
              <p className="truncate text-[11px] text-subtle">Employee portal</p>
            </div>
          </div>
          <form action={essSignOutAction}>
            <button type="submit" className="btn btn-secondary">Sign out</button>
          </form>
        </div>
        <PortalNav />
      </header>
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5">{children}</main>
    </div>
  );
}
