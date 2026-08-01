import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateIssuedToAction, deleteUserAction } from "./actions";
import { CreateUserForm } from "./create-user-form";

export default async function SettingsPage() {
  const admin = await requireAdmin();

  const [settings, users] = await Promise.all([
    prisma.settings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Defaults used when generating company timesheets, and who can sign in.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Billing entity
        </h2>
        <form
          action={updateIssuedToAction}
          className="max-w-md rounded-2xl border border-slate-200 bg-white p-5"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              &ldquo;Issued To&rdquo; name (your company, as billed by suppliers)
            </span>
            <input
              name="issuedTo"
              defaultValue={settings.issuedTo}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Company TRN (printed on client invoices)
            </span>
            <input
              name="companyTrn"
              defaultValue={settings.companyTrn ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
            />
          </label>
          <button
            type="submit"
            className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Save
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Team</h2>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {u.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3 text-slate-600">{u.role}</td>
                    <td className="px-4 py-3 text-right">
                      {u.id !== admin.id && (
                        <form action={deleteUserAction}>
                          <input type="hidden" name="userId" value={u.id} />
                          <button
                            type="submit"
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-3 text-sm font-medium text-slate-900">
              Add team member
            </h3>
            <CreateUserForm />
          </div>
        </div>
      </section>
    </div>
  );
}
