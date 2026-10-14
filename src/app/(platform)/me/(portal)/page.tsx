import Link from "next/link";
import { prisma } from "@/lib/db";
import { getEssEmployee } from "@/lib/ess/session";
import { Badge, type BadgeColor } from "@/components/Badge";

export const metadata = { title: "My portal" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function PortalHome() {
  const employee = (await getEssEmployee())!;
  const today = new Date();
  const [slip, docs] = await Promise.all([
    prisma.payrollLine.findFirst({
      where: { employeeId: employee.id, run: { status: { in: ["APPROVED", "PAID"] } } },
      orderBy: { run: { month: "desc" } },
      include: { run: { select: { month: true, status: true } } },
    }),
    prisma.document.findMany({
      where: { employeeId: employee.id, displayInEss: true, expiryDate: { not: null } },
      orderBy: { expiryDate: "asc" },
      take: 4,
      select: { id: true, type: true, expiryDate: true },
    }),
  ]);

  return (
    <>
      <section className="card p-5">
        <p className="text-sm text-muted">Welcome</p>
        <h1 className="text-xl font-semibold tracking-tight text-primary">{employee.name}</h1>
        <p className="mt-1 text-sm text-secondary">
          {employee.employeeIdNo}
          {(employee.trade || employee.position) && ` · ${employee.trade ?? employee.position}`}
          {employee.project && ` · ${employee.project.name}`}
          {employee.site && ` · ${employee.site.name}`}
        </p>
      </section>

      <div className="grid gap-4">
        <Link href="/me/payslips" className="card block p-4 transition hover:border-[var(--brand-primary)]">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">Latest payslip</p>
          {slip ? (
            <>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-primary">AED {aed(Number(slip.net))}</p>
              <p className="text-xs text-muted">{slip.run.month} · {slip.run.status === "PAID" ? "Paid" : "Approved"}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">No payslips yet.</p>
          )}
        </Link>
      </div>

      {docs.length > 0 && (
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-primary">Document expiry</h2>
            <Link href="/me/documents" className="text-xs font-medium text-[var(--brand-primary)] hover:underline">All documents</Link>
          </div>
          <ul className="space-y-2 text-sm">
            {docs.map((d) => {
              const days = Math.ceil((d.expiryDate!.getTime() - today.getTime()) / 86_400_000);
              const color: BadgeColor = days < 0 ? "red" : days <= 30 ? "amber" : "green";
              return (
                <li key={d.id} className="flex items-center justify-between gap-3">
                  <span className="text-secondary">{d.type.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</span>
                  <Badge color={color}>{days < 0 ? `Expired ${Math.abs(days)}d ago` : `${day(d.expiryDate!)} · ${days}d`}</Badge>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
