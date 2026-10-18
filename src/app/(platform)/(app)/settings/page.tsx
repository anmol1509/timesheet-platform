import { Landmark } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { prisma } from "@/lib/db";
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
      <HeroHeader
        icon={Landmark}
        title="Branches & billing"
        subtitle="The name and TRN printed on invoices, and the branches that make up this account."
        pills={[
          { label: "Billing as", value: billingBranch ? (billingBranch.issuedTo ?? billingBranch.name) : "No branch picked" },
          { label: "TRN", value: billingBranch?.trn ? "Set" : "Missing", warn: !!billingBranch && !billingBranch.trn },
          ...(isSuperAdmin ? [{ label: "Branches", value: String(branches.length) }, { label: "API access on", value: String(branches.filter((b) => b.apiAccess).length) }] : []),
        ]}
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
          className="card max-w-xl p-5"
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
    </div>
  );
}
