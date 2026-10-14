import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { monthLabelFromKey } from "@/lib/timesheetSummary";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";

export default async function UploadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const upload = await prisma.upload.findUnique({
    where: { id },
    include: { uploadedBy: true, months: { orderBy: { month: "asc" } } },
  });
  if (!upload || isOutsideBranch(upload.branchId, branchId, isSuperAdmin)) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/upload" className="text-sm text-muted hover:underline">
          ← Upload
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl tracking-tight text-primary font-semibold">
              {upload.filename}
            </h1>
            <p className="mt-1 text-sm text-muted">
              Uploaded by {upload.uploadedBy.name} on{" "}
              {new Date(upload.uploadedAt).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          {upload.fileData ? (
            <a
              href={`/api/upload/${upload.id}/download`}
              className="btn btn-primary"
            >
              Download original file
            </a>
          ) : (
            <span className="text-xs text-subtle">
              Original file not saved for this upload
            </span>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-primary">
          Months imported
        </h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Sheet name</th>
                <th className="px-4 py-3 text-right">Rows</th>
                <th className="px-4 py-3">Processed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {upload.months.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-medium text-primary">
                    {monthLabelFromKey(m.month)}
                  </td>
                  <td className="px-4 py-3 text-secondary">{m.sheetName}</td>
                  <td className="px-4 py-3 text-right text-secondary">
                    {m.rowCount}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(m.processedAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-subtle">
          Note: since uploads for the same month merge together, employee
          hours shown elsewhere in the app may reflect later uploads too, not
          only this one.
        </p>
      </div>
    </div>
  );
}
