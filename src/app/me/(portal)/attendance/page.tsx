import Link from "next/link";
import { prisma } from "@/lib/db";
import { getEssEmployee } from "@/lib/ess/session";
import { monthBounds } from "@/lib/payroll";
import { Badge, type BadgeColor } from "@/components/Badge";

export const metadata = { title: "My attendance" };
const COLOR: Record<string, BadgeColor> = { PRESENT: "green", ABSENT: "red", LEAVE: "blue", HOLIDAY: "slate", OFF: "slate" };
const LABEL: Record<string, string> = { PRESENT: "Present", ABSENT: "Absent", LEAVE: "Leave", HOLIDAY: "Holiday", OFF: "Day off" };

function shift(month: string, by: number) {
  const b = monthBounds(month)!;
  const d = new Date(Date.UTC(b.start.getUTCFullYear(), b.start.getUTCMonth() + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function EssAttendancePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const employee = (await getEssEmployee())!;
  const now = new Date();
  const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const asked = (await searchParams).month ?? thisMonth;
  const month = monthBounds(asked) ? asked : thisMonth;
  const { start, end } = monthBounds(month)!;

  const rows = await prisma.attendance.findMany({
    where: { employeeId: employee.id, date: { gte: start, lte: end } },
    orderBy: { date: "asc" },
    select: { id: true, date: true, status: true, normalHours: true, otHours: true },
  });
  const present = rows.filter((r) => r.status === "PRESENT").length;
  const absent = rows.filter((r) => r.status === "ABSENT").length;
  const normal = rows.reduce((s, r) => s + (r.normalHours ?? 0), 0);
  const ot = rows.reduce((s, r) => s + (r.otHours ?? 0), 0);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight text-primary">Attendance</h1>
        <div className="flex items-center gap-1 text-sm">
          <Link href={`/me/attendance?month=${shift(month, -1)}`} className="rounded-md px-2 py-1 text-secondary hover:bg-surface-hover" aria-label="Previous month">‹</Link>
          <span className="min-w-20 text-center font-medium text-primary">{month}</span>
          <Link href={`/me/attendance?month=${shift(month, 1)}`} className="rounded-md px-2 py-1 text-secondary hover:bg-surface-hover" aria-label="Next month">›</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Present", present], ["Absent", absent], ["Normal hrs", normal], ["Overtime hrs", ot]].map(([label, value]) => (
          <div key={label as string} className="card p-3">
            <p className="text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-primary">{value}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">No attendance recorded for {month}.</div>
      ) : (
        <ul className="card divide-y divide-[var(--border)]">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <span className="text-primary">{r.date.toISOString().slice(0, 10)}</span>
              <span className="flex items-center gap-3">
                {(r.normalHours ?? 0) > 0 && <span className="text-xs text-muted">{r.normalHours} h{(r.otHours ?? 0) > 0 && ` + ${r.otHours} OT`}</span>}
                <Badge color={COLOR[r.status] ?? "slate"}>{LABEL[r.status] ?? r.status}</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
