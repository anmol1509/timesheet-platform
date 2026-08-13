import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { Badge } from "@/components/Badge";

const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "slate"> = {
  Open: "amber",
  Quoted: "slate",
  Lost: "red",
  Converted: "green",
};

export default async function EnquiriesPage() {
  const { branchId } = await requireUserWithBranch();
  const enquiries = await prisma.enquiry.findMany({
    where: branchWhere(branchId),
    include: { client: true, quotations: { select: { id: true } } },
    orderBy: { enquiryNo: "desc" },
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Enquiries</h1>
          <p className="mt-1 text-sm text-slate-500">
            Client enquiries and RFQs, ahead of a formal quotation.
          </p>
        </div>
        <Link
          href="/sales/enquiries/new"
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
        >
          + New Enquiry
        </Link>
      </div>

      {enquiries.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center text-sm text-slate-500">
          No enquiries yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Enquiry No</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {enquiries.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">ENQ-{e.enquiryNo}</td>
                  <td className="px-4 py-3 text-slate-700">{e.client.name}</td>
                  <td className="px-4 py-3 text-slate-600">{e.requiredTrade || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[e.status] ?? "slate"}>{e.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/sales/quotations/new?enquiryId=${e.id}&clientId=${e.clientId}`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Create Quotation →
                    </Link>
                    {e.quotations.length > 0 && (
                      <span className="ml-2 text-xs text-slate-400">
                        ({e.quotations.length} quote{e.quotations.length > 1 ? "s" : ""})
                      </span>
                    )}
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
