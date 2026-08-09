import { prisma } from "@/lib/db";
import { StatTile } from "@/components/StatTile";
import { FileText, CheckCircle2, AlertTriangle } from "lucide-react";
import { complianceStatus } from "@/lib/compliance";
import { DocumentBrowser } from "./document-browser";

export default async function DocumentsPage() {
  const [documents, employees] = await Promise.all([
    prisma.document.findMany({
      include: { employee: true, uploadedBy: true },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.employee.findMany({
      select: { id: true, name: true, employeeIdNo: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const statuses = documents.map((d) => complianceStatus(d.expiryDate));
  const validCount = statuses.filter((s) => s === "valid").length;
  const expiringCount = statuses.filter(
    (s) => s === "expiring" || s === "expired"
  ).length;

  const rows = documents.map((d) => ({
    id: d.id,
    filename: d.filename,
    type: d.type,
    employeeId: d.employeeId,
    employeeName: d.employee.name,
    employeeIdNo: d.employee.employeeIdNo,
    uploadedByName: d.uploadedBy.name,
    uploadedAt: d.uploadedAt.toISOString(),
    expiryDate: d.expiryDate ? d.expiryDate.toISOString() : null,
    status: complianceStatus(d.expiryDate),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Document Management
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Track employee documents and expiry dates.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatTile
          href="/documents?tab=all"
          label="Total Documents"
          value={documents.length}
          icon={FileText}
        />
        <StatTile
          href="/documents?tab=valid"
          label="Valid Documents"
          value={validCount}
          icon={CheckCircle2}
        />
        <StatTile
          href="/documents?tab=expiring"
          label="Expiring / Expired"
          value={expiringCount}
          icon={AlertTriangle}
          tone={expiringCount > 0 ? "warning" : "default"}
        />
      </div>

      <DocumentBrowser documents={rows} employees={employees} />
    </div>
  );
}
