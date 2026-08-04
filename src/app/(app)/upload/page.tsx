import Link from "next/link";
import { prisma } from "@/lib/db";
import { UploadForm } from "./upload-form";
import { DeleteUploadButton } from "./delete-upload-button";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";

export default async function UploadPage() {
  const { user, branchId } = await requireUserWithBranch();
  const recentUploads = await prisma.upload.findMany({
    where: branchWhere(branchId),
    orderBy: { uploadedAt: "desc" },
    take: 10,
    include: { uploadedBy: true, months: true },
  });
  const isAdmin = user.role === "SUPER_ADMIN" || user.role === "BRANCH_ADMIN";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Upload</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload the consolidated time sheet workbook. Each month tab (e.g.
          &ldquo;MAY-25&rdquo;) is detected automatically, and re-uploading the
          same month just refreshes the hours already on file.
        </p>
      </div>

      <UploadForm />

      {recentUploads.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Recent uploads
          </h2>
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">Months</th>
                  <th className="px-4 py-3">Uploaded by</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentUploads.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {u.filename}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.months.map((m) => m.monthLabel).join(", ")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {u.uploadedBy.name}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(u.uploadedAt).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/upload/${u.id}`}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          View
                        </Link>
                        {u.fileData ? (
                          <a
                            href={`/api/upload/${u.id}/download`}
                            className="text-xs font-medium text-blue-600 hover:underline"
                          >
                            Download
                          </a>
                        ) : (
                          <span
                            title="Original file not saved for this upload"
                            className="text-xs font-medium text-slate-300"
                          >
                            Download
                          </span>
                        )}
                        {isAdmin && (
                          <DeleteUploadButton
                            uploadId={u.id}
                            filename={u.filename}
                            monthLabels={u.months.map((m) => m.monthLabel)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
