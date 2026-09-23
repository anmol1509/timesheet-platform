import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { updateIssuedToAction } from "./actions";
import { CreateBranchForm } from "./create-branch-form";

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const isSuperAdmin = admin.role === "SUPER_ADMIN";
  const [settings, branches] = await Promise.all([
    prisma.settings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
    isSuperAdmin ? prisma.branch.findMany({ orderBy: { code: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Billing defaults, branches, and account & access management.
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
        <h2 className="mb-3 text-sm font-semibold text-primary">Account &amp; access</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { href: "/settings/company", title: "Company profile", body: "Logo, name, address and TRN — shown in the sidebar and on generated documents." },
            { href: "/settings/team", title: "Team & access", body: "Add sub-users, assign what they can open and do, suspend or reset them." },
            { href: "/settings/roles", title: "Roles & permissions", body: "Build permission sets per module and action (view, create, edit, delete, approve, export)." },
          ].map((c) => (
            <Link key={c.href} href={c.href} className="card block p-4 transition hover:border-[var(--brand-primary)]">
              <h3 className="text-sm font-semibold text-primary">{c.title}</h3>
              <p className="mt-1 text-xs text-muted">{c.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
