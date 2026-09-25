import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteEnquiryAction } from "./actions";

const STATUS_COLOR: Record<string, "green" | "amber" | "red" | "slate"> = {
  Open: "amber",
  Quoted: "slate",
  Lost: "red",
  Converted: "green",
};

const fmtDate = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
function ageInDays(d: Date) {
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
}

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { branchId } = await requireUserWithBranch();
  const enquiries = await prisma.enquiry.findMany({
    where: branchWhere(branchId),
    include: { client: true, quotations: { select: { id: true, quotationNumber: true, status: true } } },
    orderBy: { enquiryNo: "desc" },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl tracking-tight text-primary font-semibold">Enquiries</h1>
          <p className="mt-1 text-sm text-muted">
            Client enquiries and RFQs, ahead of a formal quotation.
          </p>
        </div>
        <Link
          href="/sales/enquiries/new"
          className="btn btn-primary"
        >
          + New Enquiry
        </Link>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {enquiries.length === 0 ? (
        <EmptyState
          icon={FileQuestion}
          title="No enquiries yet"
          description="An enquiry is the first step in the sales pipeline — log what a client is asking for, then raise a quotation against it."
          action={
            <Link href="/sales/enquiries/new" className="btn btn-primary btn-sm">
              New enquiry
            </Link>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3">Enquiry</th>
                <th className="px-4 py-3">Client / project</th>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Quotations</th>
                <th className="px-4 py-3">Age</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {enquiries.map((e) => (
                <tr key={e.id} className="hover:bg-surface-hover">
                  <td className="px-4 py-3">
                    <div className="font-medium text-primary">ENQ-{e.enquiryNo}</div>
                    <div className="text-xs text-muted">{fmtDate(e.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-secondary">{e.client.name}</div>
                    {e.projectHint && <div className="text-xs text-muted">{e.projectHint}</div>}
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    {e.requiredTrade || "—"}
                    {e.remarks && <div className="max-w-[240px] truncate text-xs text-muted" title={e.remarks}>{e.remarks}</div>}
                  </td>
                  <td className="px-4 py-3 text-secondary">{e.source || "—"}</td>
                  <td className="px-4 py-3">
                    {e.quotations.length === 0 ? (
                      <span className="text-muted">None yet</span>
                    ) : (
                      <div className="flex flex-col gap-0.5 text-xs">
                        {e.quotations.slice(0, 2).map((q) => (
                          <Link key={q.id} href={`/sales/quotations/${q.id}`} className="text-primary hover:underline">
                            {q.quotationNumber} <span className="text-muted">· {q.status.toLowerCase()}</span>
                          </Link>
                        ))}
                        {e.quotations.length > 2 && <span className="text-muted">+{e.quotations.length - 2} more</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const d = ageInDays(e.createdAt);
                      const stale = e.status === "Open" && d >= 7;
                      return <span className={`tabular text-sm ${stale ? "font-medium text-[var(--warning)]" : "text-secondary"}`}>{d === 0 ? "Today" : `${d}d`}</span>;
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={STATUS_COLOR[e.status] ?? "slate"} dot>{e.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/sales/quotations/new?enquiryId=${e.id}&clientId=${e.clientId}`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Create Quotation →
                    </Link>
                    <span className="ml-3 inline-block">
                      <DeleteButton
                        action={deleteEnquiryAction}
                        hiddenFields={{ enquiryId: e.id }}
                        confirmMessage={`Delete enquiry ENQ-${e.enquiryNo} from ${e.client.name}?`}
                      />
                    </span>
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
