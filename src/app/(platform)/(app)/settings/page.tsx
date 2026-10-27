import { Landmark } from "lucide-react";
import { HeroHeader } from "@/components/HeroHeader";
import { requireAdmin, resolveSuperAdminBranchId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateIssuedToAction } from "./actions";
import { MaskedInput } from "@/components/ui/MaskedInput";

export const metadata = { title: "Company settings" };

export default async function SettingsPage() {
  const admin = await requireAdmin();
  const isSuperAdmin = admin.role === "SUPER_ADMIN";
  // The billing details belong to a branch: a branch admin edits their own; a
  // super admin edits whichever branch is selected in the switcher.
  const billingBranchId = isSuperAdmin ? await resolveSuperAdminBranchId() : admin.branchId;
  const [billingBranch] = await Promise.all([
    billingBranchId
      ? prisma.branch.findUnique({ where: { id: billingBranchId }, select: { id: true, name: true, issuedTo: true, trn: true } })
      : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-5">
      <HeroHeader
        icon={Landmark}
        title="Billing"
        subtitle="The name and TRN printed on your invoices."
        pills={[
          { label: "Billing as", value: billingBranch ? (billingBranch.issuedTo ?? billingBranch.name) : "No company picked" },
          { label: "TRN", value: billingBranch?.trn ? "Set" : "Missing", warn: !!billingBranch && !billingBranch.trn },
        ]}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-primary">
          Billing entity
        </h2>
        {!billingBranch ? (
          <p className="card max-w-md p-5 text-sm text-muted">
            Sign in as a company administrator to edit its billing details.
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

    </div>
  );
}
