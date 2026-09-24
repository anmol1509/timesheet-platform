import { Suspense } from "react";
import { cookies } from "next/headers";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { viewableModules } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { AppShell } from "./app-shell";
import { SIDEBAR_COOKIE } from "./sidebar-preference";
import { MobileSidebar } from "./mobile-sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { ShortcutsSheet } from "@/components/ShortcutsSheet";
import { BranchSwitcher } from "@/components/BranchSwitcher";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { UserMenu } from "@/components/UserMenu";
import { ToastProvider } from "@/components/ui/Toast";
import { ProgressBar } from "@/components/motion/ProgressBar";
import { getComplianceAlerts } from "@/lib/dashboardAlerts";
import { THEME_COOKIE, isThemePreference, type ThemePreference } from "@/lib/theme-preference";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";
  const themeCookieValue = cookieStore.get(THEME_COOKIE)?.value;
  const themePref: ThemePreference = isThemePreference(themeCookieValue)
    ? themeCookieValue
    : "system";
  // Header extras, not the app itself — a transient DB hiccup (e.g. a cold
  // connection) fetching these shouldn't take down every page via the root
  // layout, which no per-page error boundary can catch (error.js doesn't
  // wrap the layout.js in its own segment). Degrade to an empty header
  // instead of crashing the whole shell.
  const [alertsResult, branchesResult, inboxResult, unreadResult] = await Promise.allSettled([
    getComplianceAlerts(branchId),
    // Only SUPER_ADMIN gets a switcher — everyone else has exactly one branch.
    prisma.branch.findMany({ orderBy: { code: "asc" } }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, body: true, href: true, readAt: true },
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  const inbox = inboxResult.status === "fulfilled"
    ? inboxResult.value.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, read: n.readAt !== null }))
    : [];
  const unreadCount = unreadResult.status === "fulfilled" ? unreadResult.value : 0;
  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : [];
  const branches = branchesResult.status === "fulfilled" ? branchesResult.value : [];
  const isAdmin = user.role !== "STAFF";
  const allowedModules = viewableModules(subjectOf(user));

  // Sidebar brand: the active branch's own name and uploaded logo. A super
  // admin viewing "all branches" (branchId null) keeps the group name and
  // borrows the first uploaded logo, so uploading one is visible immediately.
  const activeBranch = branchId
    ? branches.find((b) => b.id === branchId) ?? null
    : null;
  const logoSource = activeBranch ?? branches.find((b) => b.logoId) ?? null;
  const brand = {
    name: activeBranch?.name ?? "Burj Al Aweer",
    logoUrl: logoSource?.logoId ? `/api/images/${logoSource.logoId}` : null,
  };

  const header = (
    <header className="sticky top-0 z-30 border-b border-default bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <MobileSidebar isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} allowedModules={allowedModules} brand={brand} />
        <div className="min-w-0 flex-1">
          <CommandPalette isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} allowedModules={allowedModules} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isSuperAdmin && branches.filter((b) => b.isActive).length > 1 && (
            <div className="hidden sm:block">
              <BranchSwitcher branches={branches} activeBranchId={branchId} />
            </div>
          )}
          <NotificationsMenu alerts={alerts} inbox={inbox} unreadCount={unreadCount} />
          <span className="mx-0.5 hidden h-5 w-px bg-[var(--border)] sm:block" aria-hidden />
          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role}
            avatarUrl={user.avatarId ? `/api/images/${user.avatarId}` : null}
            isAdmin={isAdmin}
            themePreference={themePref}
          />
        </div>
      </div>
    </header>
  );

  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <ProgressBar />
      </Suspense>
      <ShortcutsSheet />
      <AppShell
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        allowedModules={allowedModules}
        brand={brand}
        defaultCollapsed={sidebarCollapsed}
        header={header}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
