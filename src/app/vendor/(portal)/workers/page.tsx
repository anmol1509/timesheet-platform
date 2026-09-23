import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { Badge, type BadgeColor } from "@/components/Badge";
import { STAGE_LABEL } from "@/lib/employeeStage";

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
  const workers = await prisma.employee.findMany({
    where: { supplierId: vendor.id, status: { not: "TERMINATED" } },
    orderBy: { name: "asc" },
    select: {
      id: true, name: true, employeeIdNo: true, trade: true, status: true,
      visaExpiry: true, laborCardExpiry: true, medicalExpiry: true, passportExpiry: true, emiratesIdExpiry: true,
      project: { select: { name: true } },
    },
  });
  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-primary">Your workers</h1>
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
