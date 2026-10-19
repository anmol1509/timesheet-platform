import { UserRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireUser, subjectOf } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MODULES, can, ACTION_LABELS, describeAccess, type PermissionAction } from "@/lib/permissions";
import { Avatar } from "@/components/Avatar";
import { ImageUpload } from "@/components/ImageUpload";
import { NotificationPrefsForm, PasswordForm, ProfileForm } from "./profile-forms";
import { AccountRail, ACCOUNT_TABS, type AccountTab } from "./account-rail";
import { AppearanceForm } from "./appearance-form";
import { SessionsList, type SessionRow } from "./sessions-list";
import { canOpenPage } from "@/lib/preferenceCookies";
import { START_PAGES, parsePreferences } from "@/lib/preferences";
import { getSessionFromCookies } from "@/lib/session";
import { removeAvatarAction, uploadAvatarAction } from "./actions";

export const metadata = { title: "My account" };

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  BRANCH_ADMIN: "Branch admin",
  STAFF: "Staff",
};

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab: AccountTab = ACCOUNT_TABS.some((t) => t.key === sp.tab) ? (sp.tab as AccountTab) : "profile";
  const branch = user.branchId
    ? await prisma.branch.findUnique({ where: { id: user.branchId }, select: { code: true, name: true } })
    : null;
  const subject = subjectOf(user);
  const unrestricted = user.role !== "STAFF" || !user.accessRole;

  let content: React.ReactNode = null;
  if (tab === "profile") {
    content = (
      <div className="space-y-5">
        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold text-primary">Personal details</h2>
          <div className="mb-5">
            <ImageUpload
              currentUrl={user.avatarId ? `/api/images/${user.avatarId}` : null}
              fallback={<Avatar name={user.name} url={null} className="h-20 w-20 text-xl" />}
              label="Profile photo"
              hint="PNG or JPEG. It's cropped to a circle."
              shape="circle"
              format="image/jpeg"
              maxPx={384}
              uploadAction={uploadAvatarAction}
              removeAction={removeAvatarAction}
            />
          </div>
          <ProfileForm name={user.name} email={user.email} phone={user.phone ?? ""} jobTitle={user.jobTitle ?? ""} />
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-primary">Access</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted">Role</dt><dd className="text-primary">{ROLE_LABELS[user.role] ?? user.role}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted">Branch</dt><dd className="text-primary">{branch ? `${branch.code} · ${branch.name}` : "All branches"}</dd></div>
            {user.accessRole && <div className="flex justify-between gap-3"><dt className="text-muted">Permission set</dt><dd className="text-primary">{user.accessRole.name}</dd></div>}
          </dl>
          <p className="mt-3 text-xs text-muted">{unrestricted ? "You have access to every module you can see in the sidebar." : "Modules and actions your permission set allows:"}</p>
          {!unrestricted && (
            <ul className="mt-2 space-y-1.5 text-xs">
              {describeAccess(subject.permissions ?? []).map((m) => (
                <li key={m.key} className="space-y-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-primary">{m.label}</span>
                    {m.wholeModule && <span className="text-muted">{m.actions.map((a) => ACTION_LABELS[a]).join(", ")}</span>}
                  </div>
                  {m.pages.map((p) => (
                    <div key={p.label} className="flex flex-wrap items-baseline gap-x-2 pl-3">
                      <span className="text-secondary">{p.label}</span>
                      <span className="text-muted">{p.actions.map((a) => ACTION_LABELS[a]).join(", ")}</span>
                    </div>
                  ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    );
  } else if (tab === "appearance") {
    const startPages = START_PAGES.filter((p) => canOpenPage(subject, p.href)).map((p) => ({ href: p.href, label: p.label }));
    content = <AppearanceForm initial={parsePreferences(user.preferences)} startPages={startPages} />;
  } else if (tab === "notifications") {
    content = (
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-primary">Notifications</h2>
        <NotificationPrefsForm notifyEmail={user.notifyEmail} />
      </section>
    );
  } else if (tab === "security") {
    content = (
      <section className="card max-w-xl p-5">
        <h2 className="mb-1 text-sm font-semibold text-primary">Change password</h2>
        <p className="mb-3 text-xs text-muted">Changing it signs you out of every other device.</p>
        <PasswordForm />
      </section>
    );
  } else {
    const current = (await getSessionFromCookies())?.sid;
    const rows = await prisma.userSession.findMany({ where: { userId: user.id, revokedAt: null }, orderBy: { lastSeenAt: "desc" }, take: 20 });
    const list: SessionRow[] = rows.map((r) => ({ id: r.id, label: r.label ?? "Unknown device", ip: r.ip, createdAt: r.createdAt.toISOString(), lastSeenAt: r.lastSeenAt.toISOString(), current: r.id === current, phone: /iPhone|Android|iPad/.test(r.label ?? "") }));
    content = (
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-primary">Where you&apos;re signed in</h2>
        {list.length === 0 ? <p className="mb-3 text-sm text-muted">This sign-in started before devices were listed. Sign in again to see it here.</p> : null}
        <SessionsList rows={list} />
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title="My account" icon={UserRound} description="Your profile, how the app looks, and how you sign in." />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <AccountRail active={tab} />
        <div className="min-w-0 flex-1">{content}</div>
      </div>
    </div>
  );
}
