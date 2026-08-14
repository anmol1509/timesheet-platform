import { requireAdmin } from "@/lib/auth";
import { getSessionFromCookies } from "@/lib/session";
import { prisma } from "@/lib/db";
import { updateIssuedToAction, deleteUserAction } from "./actions";
import { CreateUserForm } from "./create-user-form";
import { CreateBranchForm } from "./create-branch-form";
import { DeleteButton } from "@/components/DeleteButton";
import { branchWhere } from "@/lib/branch";

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const isSuperAdmin = admin.role === "SUPER_ADMIN";
  const branchId = isSuperAdmin
    ? ((await getSessionFromCookies())?.activeBranchId ?? null)
    : admin.branchId;

  const [settings, users, branches] = await Promise.all([
    prisma.settings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
    prisma.user.findMany({
      where: isSuperAdmin ? {} : branchWhere(branchId),
      orderBy: { createdAt: "asc" },
      include: { branch: true },
    }),
    isSuperAdmin ? prisma.branch.findMany({ orderBy: { code: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Defaults used when generating company timesheets, and who can sign in.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-primary">
          Billing entity
        </h2>
        <form
          action={updateIssuedToAction}
          className="card max-w-md p-5"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              &ldquo;Issued To&rdquo; name (your company, as billed by suppliers)
            </span>
            <input
              name="issuedTo"
              defaultValue={settings.issuedTo}
              className="input w-full"
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Company TRN (printed on client invoices)
            </span>
            <input
              name="companyTrn"
              defaultValue={settings.companyTrn ?? ""}
              className="input w-full"
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary mt-3"
          >
            Save
          </button>
        </form>
      </section>

      {isSuperAdmin && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-primary">Branches</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Emirate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {branches.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-3 font-medium text-primary">{b.code}</td>
                      <td className="px-4 py-3 text-secondary">{b.name}</td>
                      <td className="px-4 py-3 text-secondary">{b.emirate ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-medium text-primary">Add branch</h3>
              <CreateBranchForm />
            </div>
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-primary">Team</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  {isSuperAdmin && <th className="px-4 py-3">Branch</th>}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium text-primary">
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-secondary">{u.email}</td>
                    <td className="px-4 py-3 text-secondary">{u.role}</td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-secondary">
                        {u.branch?.code ?? "— (all)"}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      {u.id !== admin.id && (
                        <DeleteButton
                          action={deleteUserAction}
                          hiddenFields={{ userId: u.id }}
                          confirmMessage={`Remove "${u.name}" (${u.email}) from your team? They will lose access immediately.`}
                          label="Remove"
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card p-5">
            <h3 className="mb-3 text-sm font-medium text-primary">
              Add team member
            </h3>
            <CreateUserForm isSuperAdmin={isSuperAdmin} branches={branches} />
          </div>
        </div>
      </section>
    </div>
  );
}
