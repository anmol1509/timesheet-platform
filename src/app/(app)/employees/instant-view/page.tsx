import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { branchWhere, isOutsideBranch } from "@/lib/branch";
import { InstantViewPicker } from "./picker";
import { Badge } from "@/components/Badge";
import {
  COMPLIANCE_FIELDS,
  complianceStatus,
  daysUntil,
  type ComplianceStatus,
} from "@/lib/compliance";

const STATUS_COLOR: Record<ComplianceStatus, "green" | "amber" | "red" | "slate"> = {
  valid: "green",
  expiring: "amber",
  expired: "red",
  not_set: "slate",
};

function categoryWhere(category: string) {
  if (category === "ALL") return {};
  if (category === "SUPPLIER_LABOUR") return { supplierId: { not: null } };
  if (category === "STAFF") return { supplierId: null, category: "STAFF" as const };
  return { supplierId: null, category: "SITE_STAFF" as const };
}

function formatDate(d: Date | null) {
  return d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";
}

export default async function InstantViewPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; employeeId?: string }>;
}) {
  const { category: rawCategory, employeeId } = await searchParams;
  // Defaults to everyone: the old default hid most of the roster behind a
  // filter nobody had chosen.
  const category = ["ALL", "SITE_STAFF", "STAFF", "SUPPLIER_LABOUR"].includes(rawCategory ?? "")
    ? rawCategory!
    : "ALL";
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const employees = await prisma.employee.findMany({
    where: { ...branchWhere(branchId), ...categoryWhere(category) },
    select: { id: true, employeeIdNo: true, name: true },
    orderBy: { name: "asc" },
  });

  const employee = employeeId
    ? await prisma.employee.findUnique({
        where: { id: employeeId },
        include: {
          supplier: true,
          project: true,
          branch: true,
          assignmentHistory: { orderBy: { mobilizedDate: "desc" } },
          accommodationHistory: { orderBy: { checkInDate: "desc" } },
        },
      })
    : null;

  const validEmployee =
    employee && !isOutsideBranch(employee.branchId, branchId, isSuperAdmin) ? employee : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl tracking-tight text-primary font-semibold">Employee Instant View</h1>
        <p className="mt-1 text-sm text-muted">
          A printable snapshot of an employee&rsquo;s current status plus work and accommodation history.
        </p>
      </div>

      <InstantViewPicker category={category} employeeId={employeeId ?? ""} employees={employees} />

      {validEmployee && (
        <div className="card space-y-6 p-6">
          <div className="flex items-center gap-4">
            {/* A snapshot used to identify someone at a gate needs the face. */}
            <span className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-default bg-surface-sunken">
              {validEmployee.photoData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/employees/${validEmployee.id}/photo`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-subtle">
                  {validEmployee.name
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((part) => part[0])
                    .join("")
                    .toUpperCase()}
                </span>
              )}
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-primary">{validEmployee.name}</h2>
              <p className="tabular text-sm text-muted">
                {validEmployee.employeeIdNo}
                {validEmployee.trade ? ` · ${validEmployee.trade}` : ""}
                {validEmployee.supplier?.name ? ` · ${validEmployee.supplier.name}` : ""}
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-primary">Documents &amp; expiry</h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {COMPLIANCE_FIELDS.map((field) => {
                const value = validEmployee[field.key as keyof typeof validEmployee] as
                  | Date
                  | null;
                const status = complianceStatus(value);
                const days = value ? daysUntil(value) : null;
                return (
                  <div
                    key={field.key}
                    className="flex items-center justify-between gap-3 border-b border-default py-1.5"
                  >
                    <span className="text-muted">{field.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="tabular text-primary">{formatDate(value)}</span>
                      {value && (
                        <Badge color={STATUS_COLOR[status]}>
                          {days === null
                            ? "Valid"
                            : days < 0
                              ? `${Math.abs(days)}d overdue`
                              : days <= 90
                                ? `${days}d left`
                                : "Valid"}
                        </Badge>
                      )}
                      {!value && <Badge color="slate">Not recorded</Badge>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <span className="block text-xs font-medium text-muted">Employee ID</span>
              {validEmployee.employeeIdNo}
            </div>
            <div>
              <span className="block text-xs font-medium text-muted">Previous ID</span>
              {validEmployee.previousId || "—"}
            </div>
            <div>
              <span className="block text-xs font-medium text-muted">Mobile</span>
              {validEmployee.mobileNumber || "—"}
            </div>
            <div>
              <span className="block text-xs font-medium text-muted">Trade</span>
              {validEmployee.trade || "—"}
            </div>
            <div>
              <span className="block text-xs font-medium text-muted">Supplier</span>
              {validEmployee.supplier?.name || "—"}
            </div>
            <div>
              <span className="block text-xs font-medium text-muted">Current Branch</span>
              {validEmployee.branch?.name || "—"}
            </div>
            <div>
              <span className="block text-xs font-medium text-muted">Passport Number</span>
              {validEmployee.passportNumber || "—"}
            </div>
            <div>
              <span className="block text-xs font-medium text-muted">Sponsor Name</span>
              {validEmployee.sponsorName || "—"}
            </div>
            <div>
              <span className="block text-xs font-medium text-muted">Nationality</span>
              {validEmployee.nationality || "—"}
            </div>
            <div>
              <span className="block text-xs font-medium text-muted">Status</span>
              {validEmployee.active ? "Active" : "InActive"}
            </div>
            <div>
              <span className="block text-xs font-medium text-muted">Current Project</span>
              {validEmployee.project?.name || "—"}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-primary">Work History</h3>
            {validEmployee.assignmentHistory.length === 0 ? (
              <p className="text-sm text-subtle">No assignment history recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-default text-left text-xs font-medium tracking-wide text-muted uppercase">
                  <tr>
                    <th className="py-2">Branch Name</th>
                    <th className="py-2">Project</th>
                    <th className="py-2">Mobilized Date</th>
                    <th className="py-2">Demobilized Date</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {validEmployee.assignmentHistory.map((h) => (
                    <tr key={h.id}>
                      <td className="py-2">{h.branchName || "—"}</td>
                      <td className="py-2">{h.projectName || "—"}</td>
                      <td className="py-2">{formatDate(h.mobilizedDate)}</td>
                      <td className="py-2">{formatDate(h.demobilizedDate)}</td>
                      <td className="py-2">{h.demobilizedDate ? "Demobilized" : "Mobilized"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-primary">Accommodation History</h3>
            {validEmployee.accommodationHistory.length === 0 ? (
              <p className="text-sm text-subtle">No accommodation history recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-default text-left text-xs font-medium tracking-wide text-muted uppercase">
                  <tr>
                    <th className="py-2">Camp Name</th>
                    <th className="py-2">Room</th>
                    <th className="py-2">Bed</th>
                    <th className="py-2">Check In Date</th>
                    <th className="py-2">Check Out Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {validEmployee.accommodationHistory.map((h) => (
                    <tr key={h.id}>
                      <td className="py-2">{h.campName || "—"}</td>
                      <td className="py-2">{h.roomName || "—"}</td>
                      <td className="py-2">{h.bedLabel || "—"}</td>
                      <td className="py-2">{formatDate(h.checkInDate)}</td>
                      <td className="py-2">{formatDate(h.checkOutDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
