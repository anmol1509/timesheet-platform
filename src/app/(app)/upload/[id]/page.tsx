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
        <Link href="/upload" className="text-sm text-slate-500 hover:underline">
          ← Upload
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {upload.filename}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
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
              className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--brand-primary-hover)]"
            >
              Download original file
            </a>
          ) : (
            <span className="text-xs text-slate-400">
              Original file not saved for this upload
            </span>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Months imported
        </h2>
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Month</th>
                <th className="px-4 py-3">Sheet name</th>
                <th className="px-4 py-3 text-right">Rows</th>
                <th className="px-4 py-3">Processed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {upload.months.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {monthLabelFromKey(m.month)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.sheetName}</td>
                  <td className="px-4 py-3 text-right text-slate-600">
                    {m.rowCount}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
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
        <p className="mt-3 text-xs text-slate-400">
          Note: since uploads for the same month merge together, employee
          hours shown elsewhere in the app may reflect later uploads too, not
          only this one.
        </p>
      </div>
    </div>
  );
}
