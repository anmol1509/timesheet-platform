import { prisma } from "@/lib/db";
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
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Sponsorship Companies
        </h1>
        <p className="mt-1 text-sm text-slate-500">
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
        className="flex flex-wrap items-end gap-3 rounded-3xl border border-slate-200 bg-white p-4"
      >
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Company name
          </span>
          <input
            name="name"
            required
            placeholder="e.g. Top Peak Sponsorship"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <label className="block flex-1 min-w-[220px]">
          <span className="mb-1 block text-xs font-medium text-slate-500">
            Short name
          </span>
          <input
            name="shortName"
            placeholder="e.g. TPS"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-[#166534] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#166534]/90"
        >
          + Add Sponsorship Company
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No sponsorship companies yet. Add one above.
        </p>
      ) : (
        <SponsorshipCompanyList sponsorshipCompanies={rows} />
      )}
    </div>
  );
}
