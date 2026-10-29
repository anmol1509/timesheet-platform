import { countPendingApprovals } from "@/lib/approvals";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { viewableModules } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { AppShell } from "./app-shell";
import { AppAnalytics } from "./app-analytics";
import { SIDEBAR_COOKIE } from "./sidebar-preference";
import { MobileSidebar } from "./mobile-sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { NavAssistant } from "@/components/NavAssistant";
import { ShortcutsSheet } from "@/components/ShortcutsSheet";
import { NotificationsMenu } from "@/components/NotificationsMenu";
import { AiCreditsBar } from "@/components/AiCreditsBar";
import Link from "next/link";
import { isOwnerUser } from "@/lib/owner";
import { ownerConsoleOn } from "@/lib/ownerServer";
import { loadCreditStatus } from "@/lib/aiCreditsServer";
import { UserMenu } from "@/components/UserMenu";
import { ToastProvider } from "@/components/ui/Toast";
import { ProgressBar } from "@/components/motion/ProgressBar";
import { getComplianceAlerts } from "@/lib/dashboardAlerts";
import { LAYOUT_COOKIE, LOOK_COOKIE, parseLook, parsePreferences } from "@/lib/preferences";
import { THEME_COOKIE, isThemePreference, type ThemePreference } from "@/lib/theme-preference";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get(SIDEBAR_COOKIE)?.value === "1";
  const layout = parsePreferences({ layout: cookieStore.get(LAYOUT_COOKIE)?.value }).layout;
  const autoHide = parseLook(cookieStore.get(LOOK_COOKIE)?.value).autoHide;
  const themeCookieValue = cookieStore.get(THEME_COOKIE)?.value;
  // Same default as the root layout: unset means light, not "follow system".
  const themePref: ThemePreference = isThemePreference(themeCookieValue)
    ? themeCookieValue
    : "light";
  // Header extras, not the app itself — a transient DB hiccup (e.g. a cold
  // connection) fetching these shouldn't take down every page via the root
  // layout, which no per-page error boundary can catch (error.js doesn't
  // wrap the layout.js in its own segment). Degrade to an empty header
  // instead of crashing the whole shell.
  // One round trip for everything the header and sidebar need, instead of four in a row.
  const [alertsResult, branchesResult, inboxResult, unreadResult, aiResult, approvalsResult, ticketsResult] = await Promise.allSettled([
    getComplianceAlerts(branchId),
    // Only SUPER_ADMIN gets a switcher — everyone else has exactly one branch.
    prisma.branch.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, isActive: true, logoId: true, emirate: true },
    }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, body: true, href: true, readAt: true },
    }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
    // The AI credits bar is a header extra too: if the count can't be read it simply doesn't show.
    branchId && !isSuperAdmin ? loadCreditStatus(branchId) : Promise.resolve(null),
    // A failed count must never take the page down: the badge just doesn't show.
    countPendingApprovals({ branchId, isSuperAdmin, subject: subjectOf(user), role: user.role }),
    // Sidebar badges, only where somebody has to act: documents expiring or expired, and supplier tickets still
    // waiting for a reply. Both degrade to "no badge" rather than failing the page.
    prisma.supplierTicket.count({ where: { ...branchWhere(branchId), status: "OPEN" } }),
  ]);
  const inbox = inboxResult.status === "fulfilled"
    ? inboxResult.value.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, read: n.readAt !== null }))
    : [];
  const unreadCount = unreadResult.status === "fulfilled" ? unreadResult.value : 0;
  const alerts = alertsResult.status === "fulfilled" ? alertsResult.value : [];
  const branches = branchesResult.status === "fulfilled" ? branchesResult.value : [];
  const aiStatus = aiResult.status === "fulfilled" ? aiResult.value : null;
  const pendingApprovals = approvalsResult.status === "fulfilled" ? approvalsResult.value : 0;
  const openTickets = ticketsResult.status === "fulfilled" ? ticketsResult.value : 0;
  const isAdmin = user.role !== "STAFF";
  const showOwner = ownerConsoleOn() && isOwnerUser(user);
  const allowedModules = viewableModules(subjectOf(user));
  const badges: Record<string, number> = {
    "/employees/renewals": alerts.length,
    "/suppliers/tickets": openTickets,
  };

  // Sidebar brand: the active branch's own name and uploaded logo. A super
  // admin viewing "all branches" (branchId null) keeps the group name and
  // borrows the first uploaded logo, so uploading one is visible immediately.
  const activeBranch = branchId
    ? branches.find((b) => b.id === branchId) ?? null
    : null;
  const logoSource = activeBranch ?? branches.find((b) => b.logoId) ?? null;
  const brand = {
    name: activeBranch?.name ?? "Workforce ERP",
    logoUrl: logoSource?.logoId ? `/api/images/${logoSource.logoId}` : null,
    city: activeBranch?.emirate ?? null,
  };

  // A floating glass bar to match the sidebar: same corner radius, same 12px gutters, tops aligned. On wide
  // screens the page already reserves the sidebar's width, so only the right and top gutters are added.
  const header = (
    <header className="glass sticky top-3 z-30 mx-3 mt-3 rounded-[22px] lg:ml-0">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-5">
        <MobileSidebar isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} isOwner={showOwner} allowedModules={allowedModules} brand={brand} pendingApprovals={pendingApprovals} badges={badges} />
        <div className="min-w-0 flex-1 lg:max-w-xl">
          <CommandPalette isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} allowedModules={allowedModules} />
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {ownerConsoleOn() && isOwnerUser(user) && <Link href="/owner" className="hidden rounded-full border border-default bg-surface px-3 py-1 text-xs font-medium text-secondary transition hover:text-primary sm:inline-flex">Owner</Link>}
          {aiStatus && <AiCreditsBar status={aiStatus} isAdmin={isAdmin} />}
          <NotificationsMenu alerts={alerts} inbox={inbox} unreadCount={unreadCount} pendingApprovals={pendingApprovals} />
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
      <AppAnalytics userId={user.id} role={user.role} />
      <Suspense fallback={null}>
        <ProgressBar />
      </Suspense>
      <ShortcutsSheet />
      <NavAssistant isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} allowedModules={allowedModules} />
      <AppShell
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        isOwner={showOwner}
        allowedModules={allowedModules}
        pendingApprovals={pendingApprovals}
        badges={badges}
        brand={brand}
        defaultCollapsed={sidebarCollapsed}
        layout={layout}
        autoHide={autoHide}
        header={header}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
