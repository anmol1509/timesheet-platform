import { Settings } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { setBranchApiAccessAction, updateIssuedToAction } from "./actions";
import { CreateBranchForm } from "./create-branch-form";
import { MaskedInput } from "@/components/ui/MaskedInput";

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const isSuperAdmin = admin.role === "SUPER_ADMIN";
  // The billing details belong to a branch: a branch admin edits their own; a
  // super admin edits whichever branch is selected in the switcher.
  const billingBranchId = isSuperAdmin ? await resolveSuperAdminBranchId() : admin.branchId;
  const [billingBranch, branches] = await Promise.all([
    billingBranchId
      ? prisma.branch.findUnique({ where: { id: billingBranchId }, select: { id: true, name: true, issuedTo: true, trn: true } })
      : Promise.resolve(null),
    isSuperAdmin ? prisma.branch.findMany({ orderBy: { code: "asc" } }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        icon={Settings}
        description={<>Billing defaults, branches, and account & access management.</>}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-primary">
          Billing entity
        </h2>
        {!billingBranch ? (
          <p className="card max-w-md p-5 text-sm text-muted">
            Pick a branch from the switcher (top right) to edit its billing details.
          </p>
        ) : (
        <form
          action={updateIssuedToAction}
          className="card max-w-md p-5"
        >
          <input type="hidden" name="branchId" value={billingBranch.id} />
          <p className="mb-3 text-xs text-muted">Billing details for <span className="font-medium text-primary">{billingBranch.name}</span>.</p>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              &ldquo;Issued To&rdquo; name (your company, as billed by suppliers)
            </span>
            <input
              name="issuedTo"
              defaultValue={billingBranch.issuedTo ?? billingBranch.name}
              className="input w-full"
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Company TRN (printed on client invoices)
            </span>
            <MaskedInput kind="trn"
              name="companyTrn"
              defaultValue={billingBranch.trn ?? ""}
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
        )}
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
                    <th className="px-4 py-3">API access</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {branches.map((b) => (
                    <tr key={b.id}>
                      <td className="px-4 py-3 font-medium text-primary">{b.code}</td>
                      <td className="px-4 py-3 text-secondary">{b.name}</td>
                      <td className="px-4 py-3 text-secondary">{b.emirate ?? "—"}</td>
                      <td className="px-4 py-3">
                        <form action={setBranchApiAccessAction} className="flex items-center gap-2">
                          <input type="hidden" name="branchId" value={b.id} />
                          <input type="hidden" name="enabled" value={b.apiAccess ? "0" : "1"} />
                          <span className={b.apiAccess ? "text-xs font-medium text-[var(--success)]" : "text-xs text-muted"}>{b.apiAccess ? "On" : "Off"}</span>
                          <button type="submit" className="text-xs font-medium text-[var(--brand-primary)] hover:underline">
                            {b.apiAccess ? "Turn off" : "Turn on"}
                          </button>
                        </form>
                      </td>
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
            { href: "/settings/developers", title: "Developers", body: "API keys for connecting Zoho Books, Tally, attendance devices and your own software (Pro and Custom plans)." },
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
