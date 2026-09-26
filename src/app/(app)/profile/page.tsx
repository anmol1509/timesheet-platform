import { UserRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireUser, subjectOf } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MODULES, can, ACTION_LABELS, type PermissionAction } from "@/lib/permissions";
import { Avatar } from "@/components/Avatar";
import { ImageUpload } from "@/components/ImageUpload";
import { NotificationPrefsForm, PasswordForm, ProfileForm } from "./profile-forms";
import { removeAvatarAction, uploadAvatarAction } from "./actions";

export const metadata = { title: "My profile" };

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super admin",
  BRANCH_ADMIN: "Branch admin",
  STAFF: "Staff",
};

export default async function ProfilePage() {
  const user = await requireUser();
  const branch = user.branchId
    ? await prisma.branch.findUnique({ where: { id: user.branchId }, select: { code: true, name: true } })
    : null;
  const subject = subjectOf(user);
  const unrestricted = user.role !== "STAFF" || !user.accessRole;

  return (
    <div className="space-y-5">
      <PageHeader
        title="My profile"
        icon={UserRound}
        description={<>Your name, photo and password.</>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
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

        <div className="space-y-6">
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-primary">Access</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Role</dt>
                <dd className="text-primary">{ROLE_LABELS[user.role] ?? user.role}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Branch</dt>
                <dd className="text-primary">{branch ? `${branch.code} · ${branch.name}` : "All branches"}</dd>
              </div>
              {user.accessRole && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Permission set</dt>
                  <dd className="text-primary">{user.accessRole.name}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 text-xs text-muted">
              {unrestricted
                ? "You have access to every module you can see in the sidebar."
                : "Modules and actions your permission set allows:"}
            </p>
            {!unrestricted && (
              <ul className="mt-2 space-y-1.5 text-xs">
                {MODULES.filter((m) => can(subject, m.key, "view")).map((m) => (
                  <li key={m.key} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-primary">{m.label}</span>
                    <span className="text-muted">
                      {m.actions
                        .filter((a) => can(subject, m.key, a as PermissionAction))
                        .map((a) => ACTION_LABELS[a as PermissionAction])
                        .join(", ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-primary">Notifications</h2>
            <NotificationPrefsForm notifyEmail={user.notifyEmail} notifyWhatsapp={user.notifyWhatsapp} whatsappNumber={user.whatsappNumber ?? ""} />
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold text-primary">Change password</h2>
            <PasswordForm />
          </section>
        </div>
      </div>
    </div>
  );
}
