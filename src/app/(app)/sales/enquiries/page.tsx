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

export default async function EnquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { branchId } = await requireUserWithBranch();
  const enquiries = await prisma.enquiry.findMany({
    where: branchWhere(branchId),
    include: { client: true, quotations: { select: { id: true } } },
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
                <th className="px-4 py-3">Enquiry No</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Trade</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {enquiries.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3 font-medium text-primary">ENQ-{e.enquiryNo}</td>
                  <td className="px-4 py-3 text-secondary">{e.client.name}</td>
                  <td className="px-4 py-3 text-secondary">{e.requiredTrade || "—"}</td>
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
                      <span className="ml-2 text-xs text-subtle">
                        ({e.quotations.length} quote{e.quotations.length > 1 ? "s" : ""})
                      </span>
                    )}
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
