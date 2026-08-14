import Link from "next/link";
import { FileSignature } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
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
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl tracking-tight text-primary font-semibold">Quotations</h1>
          <p className="mt-1 text-sm text-muted">
            Formal quotations with trade/quantity/rate line items.
          </p>
        </div>
        <Link
          href="/sales/quotations/new"
          className="btn btn-primary"
        >
          + New Quotation
        </Link>
      </div>

      {quotations.length === 0 ? (
        <EmptyState
          icon={FileSignature}
          title="No quotations yet"
          description="Quotations turn an enquiry into priced trade line items. Once a client accepts one, it converts straight into a project and its LPOs."
          action={
            <Link href="/sales/quotations/new" className="btn btn-primary btn-sm">
              New quotation
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Quotation No</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Lines</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {quotations.map((q) => (
                <tr key={q.id}>
                  <td className="px-4 py-3 font-medium text-primary">
                    <Link href={`/sales/quotations/${q.id}`} className="hover:underline">
                      {q.quotationNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-secondary">{q.client.name}</td>
                  <td className="px-4 py-3 text-secondary">{q.lines.length}</td>
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
