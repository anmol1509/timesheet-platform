import { prisma } from "@/lib/db";
import { Landmark } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { createSponsorshipCompanyAction } from "./actions";
import { SponsorshipCompanyList } from "./sponsorship-company-list";

export default async function SponsorshipCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { branchId } = await requireUserWithBranch();
  const sponsorshipCompanies = await prisma.sponsorshipCompany.findMany({
    where: branchWhere(branchId),
    select: {
      id: true,
      name: true,
      shortName: true,
      country: true,
      phone: true,
      tradeLicenseNumber: true,
      _count: { select: { employees: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows = sponsorshipCompanies.map((c) => ({
    id: c.id,
    name: c.name,
    shortName: c.shortName,
    country: c.country,
    phone: c.phone,
    tradeLicenseNumber: c.tradeLicenseNumber,
    employeeCount: c._count.employees,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">
          Sponsorship Companies
        </h1>
        <p className="mt-1 text-sm text-muted">
          Manage the visa-sponsoring companies referenced across employees.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form
        action={createSponsorshipCompanyAction}
        className="card flex flex-wrap items-end gap-3 p-4"
      >
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-muted">
            Company name
          </span>
          <input
            name="name"
            required
            placeholder="e.g. Top Peak Sponsorship"
            className="input w-full"
          />
        </label>
        <label className="block flex-1 min-w-[220px]">
          <span className="mb-1 block text-xs font-medium text-muted">
            Short name
          </span>
          <input
            name="shortName"
            placeholder="e.g. TPS"
            className="input w-full"
          />
        </label>
        <button
          type="submit"
          className="btn btn-primary"
        >
          + Add Sponsorship Company
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No sponsorship companies yet"
          description="Sponsorship companies hold your workers' visas. Add one above so employee visa and labour card records can be attributed correctly."
        />
      ) : (
        <SponsorshipCompanyList sponsorshipCompanies={rows} />
      )}
    </div>
  );
}
