import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { Badge, type BadgeColor } from "@/components/Badge";
import { STAGE_LABEL } from "@/lib/employeeStage";
import { AddWorker, SubmissionList, type SubmissionRow } from "./add-worker";

export const metadata = { title: "Your workers" };
const DAY = 86_400_000;

function chip(label: string, d: Date | null) {
  if (!d) return null;
  const days = Math.ceil((d.getTime() - new Date().getTime()) / DAY);
  const color: BadgeColor = days < 0 ? "red" : days <= 30 ? "amber" : "green";
  return <Badge key={label} color={color}>{label} {days < 0 ? "expired" : `${days}d`}</Badge>;
}

export default async function VendorWorkersPage() {
  const vendor = (await getVendor())!;
  const [workers, subs, skills] = await Promise.all([
    prisma.employee.findMany({
      where: { supplierId: vendor.id, status: { not: "TERMINATED" } },
      orderBy: { name: "asc" },
      select: {
        id: true, name: true, employeeIdNo: true, trade: true, status: true,
        visaExpiry: true, laborCardExpiry: true, medicalExpiry: true, passportExpiry: true, emiratesIdExpiry: true,
        project: { select: { name: true } },
      },
    }),
    prisma.workerSubmission.findMany({ where: { supplierId: vendor.id, status: { in: ["PENDING", "REJECTED"] } }, orderBy: { submittedAt: "desc" } }),
    prisma.skill.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  const rows: SubmissionRow[] = subs.map((s) => ({
    id: s.id, name: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "), trade: s.trade, status: s.status, note: s.note,
    submittedAt: s.submittedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
  }));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-primary">Your workers</h1>
          <p className="mt-1 text-sm text-muted">Workers linked to your company. New ones are checked by our team before they are added.</p>
        </div>
        <AddWorker trades={skills.map((s) => s.name)} enabled={vendor.labourApprovalStatus === "Approved"} />
      </div>

      <SubmissionList rows={rows} />

      {workers.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No workers are linked to your company yet.</div>
      ) : (
        <ul className="card divide-y divide-[var(--border)]">
          {workers.map((w) => (
            <li key={w.id} className="space-y-1.5 px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm font-medium text-primary">{w.name} <span className="font-normal text-muted">· {w.employeeIdNo}</span></p>
                <span className="text-xs text-muted">{STAGE_LABEL[w.status as keyof typeof STAGE_LABEL] ?? w.status}{w.project ? ` · ${w.project.name}` : ""}</span>
              </div>
              {w.trade && <p className="text-xs text-muted">{w.trade}</p>}
              <div className="flex flex-wrap gap-1.5">
                {[chip("Visa", w.visaExpiry), chip("Labour card", w.laborCardExpiry), chip("Medical", w.medicalExpiry), chip("Passport", w.passportExpiry), chip("Emirates ID", w.emiratesIdExpiry)]}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
