import { prisma } from "@/lib/db";

export type SetupStep = {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  /** How many the company has (real data only), for the steps that count something. */
  count?: number;
  href: string;
  action: string;
};

/** Import batches that loaded the sample company. */
export const SAMPLE_MARK = '"sample":true';

/** What has been set up so far, worked out from the company's real data (sample data is not counted). */
export async function getSetupSteps(branchId: string): Promise<SetupStep[]> {
  const [branch, suppliers, clients, workers, entries, users, sampleChanges] = await Promise.all([
    prisma.branch.findUnique({ where: { id: branchId }, select: { trn: true, address: true, phone: true, logoId: true } }),
    prisma.supplier.count({ where: { branchId } }),
    prisma.client.count({ where: { branchId } }),
    prisma.employee.count({ where: { branchId } }),
    prisma.timesheetEntry.count({ where: { branchId } }),
    prisma.user.count({ where: { branchId } }),
    prisma.importChange.groupBy({
      by: ["model"],
      where: { action: "CREATE", batch: { branchId, status: "DONE", options: { contains: SAMPLE_MARK } } },
      _count: { _all: true },
    }),
  ]);
  const sample = new Map(sampleChanges.map((s) => [s.model, s._count._all]));
  const real = (total: number, model: string) => Math.max(0, total - (sample.get(model) ?? 0));
  const s = real(suppliers, "Supplier"), c = real(clients, "Client"), w = real(workers, "Employee"), t = real(entries, "TimesheetEntry");

  return [
    {
      key: "company",
      title: "Add your company details",
      detail: "Name, TRN and address appear on your invoices and letters.",
      done: !!branch?.trn && !!(branch.address || branch.phone),
      href: "/settings/company",
      action: "Open company profile",
    },
    {
      key: "suppliers",
      title: "Add your suppliers",
      detail: s > 0 ? `${s} added` : "Manpower suppliers and sub-suppliers, with their codes.",
      done: s > 0, count: s, href: "/import/new/suppliers", action: "Import suppliers",
    },
    {
      key: "clients",
      title: "Add your clients",
      detail: c > 0 ? `${c} added` : "The companies you supply workers to.",
      done: c > 0, count: c, href: "/import/new/clients", action: "Import clients",
    },
    {
      key: "workers",
      title: "Add your workers",
      detail: w > 0 ? `${w} added` : "Codes, trades, nationality and document dates.",
      done: w > 0, count: w, href: "/import/new/workers", action: "Import workers",
    },
    {
      key: "timesheets",
      title: "Bring in a month of timesheets",
      detail: t > 0 ? `${t} timesheet rows` : "Hours and attendance for every worker, from your existing sheet.",
      done: t > 0, count: t, href: "/import/new/timesheets", action: "Import timesheets",
    },
    {
      key: "team",
      title: "Invite your team",
      detail: users > 1 ? `${users} people have access` : "Give supervisors and accountants their own logins.",
      done: users > 1, count: users, href: "/settings/team", action: "Invite people",
    },
  ];
}
