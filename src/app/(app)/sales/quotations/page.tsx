import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { Badge } from "@/components/Badge";

const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "slate"> = {
  DRAFT: "slate",
  SENT: "amber",
  NEGOTIATION: "amber",
  APPROVED: "green",
  ACCEPTED: "green",
  REJECTED: "red",
  CONVERTED: "green",
};

export default async function QuotationsPage() {
  const { branchId } = await requireUserWithBranch();
  const quotations = await prisma.quotation.findMany({
    where: branchWhere(branchId),
    include: { client: true, lines: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Quotations</h1>
          <p className="mt-1 text-sm text-slate-500">
            Formal quotations with trade/quantity/rate line items.
          </p>
        </div>
        <Link
          href="/sales/quotations/new"
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
        >
          + New Quotation
        </Link>
      </div>

      {quotations.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No quotations yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Quotation No</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Lines</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotations.map((q) => (
                <tr key={q.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/sales/quotations/${q.id}`} className="hover:underline">
                      {q.quotationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{q.client.name}</td>
                  <td className="px-4 py-3 text-slate-600">{q.lines.length}</td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[q.status] ?? "slate"}>{q.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
