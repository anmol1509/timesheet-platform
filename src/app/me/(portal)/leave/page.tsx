import { prisma } from "@/lib/db";
import { getEssEmployee } from "@/lib/ess/session";
import { daysInYear, LEAVE_STATUS_LABELS } from "@/lib/leave";
import { Badge, type BadgeColor } from "@/components/Badge";
import { RequestLeaveForm } from "./request-form";
import { CancelLeaveButton } from "./cancel-button";

export const metadata = { title: "My leave" };
const COLOR: Record<string, BadgeColor> = { PENDING: "amber", APPROVED: "green", REJECTED: "red", CANCELLED: "slate" };
const day = (d: Date) => d.toISOString().slice(0, 10);

export default async function EssLeavePage() {
  const employee = (await getEssEmployee())!;
  const year = new Date().getUTCFullYear();
  const [types, requests] = await Promise.all([
    prisma.leaveType.findMany({ where: { branchId: employee.branchId, isActive: true }, orderBy: { name: "asc" } }),
    prisma.leaveRequest.findMany({
      where: { employeeId: employee.id },
      orderBy: { startDate: "desc" },
      take: 30,
      include: { leaveType: { select: { name: true, id: true } } },
    }),
  ]);

  const used = new Map<string, number>();
  for (const r of requests) {
    if (r.status !== "APPROVED") continue;
    used.set(r.leaveTypeId, (used.get(r.leaveTypeId) ?? 0) + daysInYear(r.startDate, r.endDate, year));
  }
  const capped = types.filter((t) => t.daysPerYear > 0);

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight text-primary">Leave</h1>

      {capped.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-semibold text-primary">Your balance for {year}</h2>
          <ul className="space-y-1.5 text-sm">
            {capped.map((t) => {
              const u = used.get(t.id) ?? 0;
              return (
                <li key={t.id} className="flex items-center justify-between gap-3">
                  <span className="text-secondary">{t.name}</span>
                  <span className="tabular-nums text-primary">{Math.max(0, t.daysPerYear - u)} <span className="text-muted">of {t.daysPerYear} days left</span></span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {types.length > 0 ? <RequestLeaveForm types={types.map((t) => ({ id: t.id, name: t.name }))} /> : (
        <div className="card p-5 text-sm text-muted">Leave requests aren&apos;t set up yet. Please speak to your office.</div>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-primary">Your requests</h2>
        {requests.length === 0 ? (
          <div className="card p-6 text-center text-sm text-muted">No leave requests yet.</div>
        ) : (
          <ul className="card divide-y divide-[var(--border)]">
            {requests.map((r) => (
              <li key={r.id} className="space-y-1 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-primary">{r.leaveType.name}</span>
                  <Badge color={COLOR[r.status] ?? "slate"} dot>{LEAVE_STATUS_LABELS[r.status] ?? r.status}</Badge>
                </div>
                <p className="text-xs text-muted">{day(r.startDate)} → {day(r.endDate)} · {r.days} day{r.days === 1 ? "" : "s"}</p>
                {r.decisionNote && <p className="text-xs text-secondary">Office note: {r.decisionNote}</p>}
                {r.status === "PENDING" && r.requestedViaPortal && <CancelLeaveButton id={r.id} />}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
