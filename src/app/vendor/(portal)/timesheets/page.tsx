import Link from "next/link";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { monthBounds } from "@/lib/payroll";

export const metadata = { title: "Timesheets" };

function shift(month: string, by: number) {
  const b = monthBounds(month)!;
  const d = new Date(Date.UTC(b.start.getUTCFullYear(), b.start.getUTCMonth() + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function VendorTimesheetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const vendor = (await getVendor())!;
  const now = new Date();
  const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const asked = (await searchParams).month ?? thisMonth;
  const month = monthBounds(asked) ? asked : thisMonth;
  const { start, end } = monthBounds(month)!;

  const rows = await prisma.attendance.findMany({
    where: { employee: { supplierId: vendor.id }, date: { gte: start, lte: end } },
    select: { employeeId: true, status: true, normalHours: true, otHours: true, employee: { select: { name: true, employeeIdNo: true } } },
  });
  const per = new Map<string, { name: string; idNo: string; present: number; absent: number; leave: number; normal: number; ot: number }>();
  for (const r of rows) {
    const p = per.get(r.employeeId) ?? { name: r.employee.name, idNo: r.employee.employeeIdNo, present: 0, absent: 0, leave: 0, normal: 0, ot: 0 };
    if (r.status === "PRESENT") p.present++;
    else if (r.status === "ABSENT") p.absent++;
    else if (r.status === "LEAVE") p.leave++;
    p.normal += r.normalHours ?? 0;
    p.ot += r.otHours ?? 0;
    per.set(r.employeeId, p);
  }
  const list = [...per.values()].sort((a, b) => a.name.localeCompare(b.name));
  const total = list.reduce((s, p) => ({ normal: s.normal + p.normal, ot: s.ot + p.ot }), { normal: 0, ot: 0 });

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-primary">Timesheets</h1>
        <div className="flex items-center gap-1 text-sm">
          <Link href={`/vendor/timesheets?month=${shift(month, -1)}`} className="rounded-md px-2 py-1 text-secondary hover:bg-surface-hover" aria-label="Previous month">‹</Link>
          <span className="min-w-20 text-center font-medium text-primary">{month}</span>
          <Link href={`/vendor/timesheets?month=${shift(month, 1)}`} className="rounded-md px-2 py-1 text-secondary hover:bg-surface-hover" aria-label="Next month">›</Link>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No attendance recorded for your workers in {month}.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Worker</th><th className="px-3 py-3 text-right">Present</th><th className="px-3 py-3 text-right">Absent</th><th className="px-3 py-3 text-right">Leave</th><th className="px-3 py-3 text-right">Normal h</th><th className="px-3 py-3 text-right">OT h</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {list.map((p) => (
                <tr key={p.idNo}>
                  <td className="px-4 py-3"><p className="font-medium text-primary">{p.name}</p><p className="text-xs text-muted">{p.idNo}</p></td>
                  <td className="px-3 py-3 text-right tabular-nums text-secondary">{p.present}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-secondary">{p.absent}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-secondary">{p.leave}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-secondary">{p.normal}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-secondary">{p.ot}</td>
                </tr>
              ))}
              <tr className="font-medium"><td className="px-4 py-3 text-primary">Total</td><td colSpan={3} /><td className="px-3 py-3 text-right tabular-nums text-primary">{total.normal}</td><td className="px-3 py-3 text-right tabular-nums text-primary">{total.ot}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
