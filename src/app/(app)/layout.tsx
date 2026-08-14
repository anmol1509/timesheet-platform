import { cookies } from "next/headers";
import { requireUserWithBranch } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "./app-shell";
import { SIDEBAR_COOKIE } from "./sidebar-preference";
import { MobileSidebar } from "./mobile-sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { UserMenu } from "@/components/UserMenu";
import { ToastProvider } from "@/components/ui/Toast";
import { getComplianceAlerts } from "@/lib/dashboardAlerts";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";
  const [alerts, branches] = await Promise.all([
    getComplianceAlerts(branchId),
    // Only SUPER_ADMIN gets a switcher — everyone else has exactly one branch.
    prisma.branch.findMany({ orderBy: { code: "asc" } }),
  ]);
  const isAdmin = user.role !== "STAFF";

  const header = (
    <header className="sticky top-0 z-30 border-b border-default bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <MobileSidebar isAdmin={isAdmin} />
        <div className="min-w-0 flex-1">
          <GlobalSearch />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isSuperAdmin && (
            <div className="hidden sm:block">
              <BranchSwitcher branches={branches} activeBranchId={branchId} />
            </div>
          )}
          <NotificationsMenu alerts={alerts} />
          <span className="mx-0.5 hidden h-5 w-px bg-[var(--border)] sm:block" aria-hidden />
          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </header>
  );

  return (
    <ToastProvider>
      <AppShell
        isAdmin={isAdmin}
        defaultCollapsed={sidebarCollapsed}
        header={header}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
