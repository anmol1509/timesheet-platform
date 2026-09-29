import Link from "next/link";
import { AlertTriangle, BedDouble, Car, ClipboardList, FolderKanban, Receipt, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { Panel } from "@/components/DashboardPanel";
import { BarList } from "@/components/BarList";
import { Badge } from "@/components/Badge";
import { ProgressBar } from "@/components/ProgressBar";
import { getDataHealth } from "@/lib/dataHealth";
import { getDemandFill, getAttendanceToday, getMoneySnapshot } from "@/lib/dashboardExtras";

// Extra sections for the module dashboards. Each is a small server component
// that reads its own data, scoped to the company, so a module page only adds
// one line and a section that fails cannot take the page down.

const DAY = 86_400_000;
const aed = (n: number) => `AED ${Math.round(n).toLocaleString()}`;
const short = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const empty = (text: string) => <p className="py-4 text-center text-sm text-muted">{text}</p>;

// ------------------------------------------------------------- workforce

export async function WorkforceExtras({ branchId, isAdmin }: { branchId: string | null; isAdmin: boolean }) {
  const bw = branchWhere(branchId);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [bench, joined, demobilised, onLeave, health] = await Promise.all([
    prisma.employee.groupBy({
      by: ["trade"],
      where: { ...bw, active: true, projectId: null, status: { notIn: ["TERMINATED", "ON_VACATION"] } },
      _count: { _all: true },
      orderBy: { _count: { trade: "desc" } },
      take: 8,
    }),
    prisma.employee.count({ where: { ...bw, createdAt: { gte: monthStart } } }),
    prisma.employee.count({ where: { ...bw, lastDemobilizedDate: { gte: monthStart } } }),
    prisma.employee.count({ where: { ...bw, status: "ON_VACATION" } }),
    isAdmin && branchId ? getDataHealth(branchId).catch(() => null) : null,
  ]);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="On bench by trade" icon={Users} href="/employees?filter=idle" className="lg:col-span-2">
        <BarList
          tone="warning"
          items={bench.map((r) => ({ key: r.trade ?? "none", label: r.trade ?? "No trade set", value: r._count._all, href: `/employees?filter=idle` }))}
          emptyLabel="Nobody is on the bench."
        />
      </Panel>
      <div className="space-y-4">
        <Panel title="Movement this month">
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between text-secondary"><span>Joined</span><span className="tabular font-medium text-primary">{joined}</span></li>
            <li className="flex justify-between text-secondary"><span>Demobilised</span><span className="tabular font-medium text-primary">{demobilised}</span></li>
            <li className="flex justify-between text-secondary"><span>On leave now</span><span className="tabular font-medium text-primary">{onLeave}</span></li>
          </ul>
        </Panel>
        {health && (
          <Panel title="Worker data health" href="/data-health" linkLabel="Details">
            <p className="flex items-baseline gap-2">
              <span className="tabular text-3xl font-semibold text-primary">{health.workers ? `${health.overall}%` : "—"}</span>
              <span className="text-xs text-muted">{health.workers ? "of the records are filled in" : "no workers yet"}</span>
            </p>
            {health.workers > 0 && <div className="mt-2"><ProgressBar value={health.overall} total={100} label="" /></div>}
          </Panel>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- projects

export async function ProjectsExtras({ branchId }: { branchId: string | null }) {
  const bw = branchWhere(branchId);
  const now = new Date();
  const projects = await prisma.project.findMany({
    where: { ...bw, status: "ACTIVE" },
    select: {
      id: true, code: true, name: true, timelineEnd: true, noOfEmployeesRequired: true,
      client: { select: { name: true } },
      _count: { select: { employees: true, sites: true } },
      demandRequests: { where: { status: "Open" }, select: { id: true } },
      lpos: { where: { status: "ACTIVE" }, select: { value: true, billedAmount: true } },
    },
    orderBy: { name: "asc" },
    take: 40,
  });
  const rows = projects
    .map((p) => {
      const lpoValue = p.lpos.reduce((n, l) => n + (l.value ?? 0), 0);
      const lpoBilled = p.lpos.reduce((n, l) => n + l.billedAmount, 0);
      const daysLeft = p.timelineEnd ? Math.ceil((p.timelineEnd.getTime() - now.getTime()) / DAY) : null;
      return { ...p, lpoValue, lpoBilled, daysLeft, openDemands: p.demandRequests.length };
    })
    .sort((a, b) => (a.daysLeft ?? 99999) - (b.daysLeft ?? 99999))
    .slice(0, 10);
  return (
    <Panel title="Active projects at a glance" icon={FolderKanban} href="/projects">
      {rows.length === 0 ? (
        empty("No active projects.")
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-2 pr-3 font-medium">Project</th>
                <th className="px-3 py-2 font-medium">Workers</th>
                <th className="px-3 py-2 font-medium">Open demand</th>
                <th className="px-3 py-2 font-medium">Sites</th>
                <th className="px-3 py-2 font-medium">LPO billed</th>
                <th className="py-2 pl-3 font-medium">Ends</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 pr-3">
                    <Link href={`/projects/${p.id}`} className="font-medium text-primary hover:underline">{p.name}</Link>
                    <p className="text-xs text-subtle">{p.client.name}</p>
                  </td>
                  <td className="tabular px-3 py-2 text-secondary">{p._count.employees}{p.noOfEmployeesRequired ? ` / ${p.noOfEmployeesRequired}` : ""}</td>
                  <td className="px-3 py-2">{p.openDemands > 0 ? <Badge color="amber">{p.openDemands} open</Badge> : <span className="text-subtle">—</span>}</td>
                  <td className="tabular px-3 py-2 text-secondary">{p._count.sites || "—"}</td>
                  <td className="px-3 py-2">
                    {p.lpoValue > 0 ? (
                      <div className="min-w-[110px]"><ProgressBar value={p.lpoBilled} total={p.lpoValue} label={`${Math.round((p.lpoBilled / p.lpoValue) * 100)}%`} /></div>
                    ) : (
                      <span className="text-subtle">No LPO</span>
                    )}
                  </td>
                  <td className="py-2 pl-3">
                    {p.timelineEnd ? (
                      <span className={p.daysLeft! < 0 ? "font-medium text-[var(--error)]" : p.daysLeft! <= 30 ? "font-medium text-[var(--warning)]" : "text-secondary"}>
                        {short(p.timelineEnd)}
                        <span className="block text-xs">{p.daysLeft! < 0 ? `overdue ${-p.daysLeft!}d` : `${p.daysLeft}d left`}</span>
                      </span>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- demand

export async function DemandExtras({ branchId }: { branchId: string | null }) {
  const bw = branchWhere(branchId);
  const now = new Date();
  const [fill, open, mobilising, onSite] = await Promise.all([
    getDemandFill(branchId),
    prisma.demandRequest.findMany({ where: { ...bw, status: { in: ["Open", "Approved"] } }, select: { createdAt: true } }),
    prisma.employee.findMany({ where: { ...bw, status: "UNDER_MOBILISATION" }, select: { mobilisationDate: true } }),
    prisma.employee.count({ where: { ...bw, status: "ON_SITE" } }),
  ]);
  const buckets = [
    { label: "Up to 7 days", max: 7 },
    { label: "8–14 days", max: 14 },
    { label: "15–30 days", max: 30 },
    { label: "Over 30 days", max: Infinity },
  ].map((b, i, arr) => {
    const min = i === 0 ? -1 : arr[i - 1].max;
    return { label: b.label, count: open.filter((r) => { const age = (now.getTime() - r.createdAt.getTime()) / DAY; return age > min && age <= b.max; }).length };
  });
  const overdueArrivals = mobilising.filter((m) => m.mobilisationDate && m.mobilisationDate < now).length;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="Shortfall by trade" icon={ClipboardList} href="/demand">
        {fill.gaps.length === 0 ? (
          empty("No trade is short right now.")
        ) : (
          <ul className="space-y-1.5">
            {fill.gaps.map((g) => (
              <li key={g.trade} className="flex items-center justify-between text-sm">
                <span className="text-secondary">{g.trade}</span>
                <span className="tabular text-xs">
                  <span className="font-medium text-[var(--warning)]">short {g.short}</span>
                  <span className="text-muted"> · {g.bench} on bench</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title="How long requests have waited" href="/demand">
        {open.length === 0 ? (
          empty("No open requests.")
        ) : (
          <BarList tone="brand" items={buckets.map((b) => ({ key: b.label, label: b.label, value: b.count }))} emptyLabel="" />
        )}
      </Panel>
      <Panel title="Mobilisation pipeline" href="/demand/site-arrival" linkLabel="Site arrival">
        <ul className="space-y-1.5 text-sm">
          <li className="flex justify-between text-secondary"><span>On the way to site</span><span className="tabular font-medium text-primary">{mobilising.length}</span></li>
          <li className="flex justify-between text-secondary"><span>Arrival overdue</span><span className={`tabular font-medium ${overdueArrivals > 0 ? "text-[var(--error)]" : "text-primary"}`}>{overdueArrivals}</span></li>
          <li className="flex justify-between text-secondary"><span>Arrived on site</span><span className="tabular font-medium text-primary">{onSite}</span></li>
        </ul>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------ facilities

export async function FacilitiesExtras({ branchId }: { branchId: string | null }) {
  const bw = branchWhere(branchId);
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * DAY);
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const [vehicles, checkedIn, checkedOut] = await Promise.all([
    prisma.vehicle.findMany({
      where: { ...bw, status: { not: "INACTIVE" }, OR: [{ registrationExpiry: { lte: soon } }, { insuranceExpiry: { lte: soon } }] },
      select: { id: true, plateNumber: true, registrationExpiry: true, insuranceExpiry: true },
      take: 20,
    }),
    prisma.campCheckIn.count({ where: { ...bw, checkInDate: { gte: weekAgo } } }),
    prisma.campCheckIn.count({ where: { ...bw, checkOutDate: { gte: weekAgo } } }),
  ]);
  const docs = vehicles
    .flatMap((v) => [
      v.registrationExpiry && v.registrationExpiry <= soon ? { id: v.id, plate: v.plateNumber, doc: "Registration", date: v.registrationExpiry } : null,
      v.insuranceExpiry && v.insuranceExpiry <= soon ? { id: v.id, plate: v.plateNumber, doc: "Insurance", date: v.insuranceExpiry } : null,
    ])
    .filter((x): x is { id: string; plate: string; doc: string; date: Date } => !!x)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 8);
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="Vehicle documents due" icon={Car} href="/transport" className="lg:col-span-2">
        {docs.length === 0 ? (
          empty("No vehicle registration or insurance expires in the next 30 days.")
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {docs.map((d) => {
              const days = Math.ceil((d.date.getTime() - now.getTime()) / DAY);
              return (
                <li key={`${d.id}-${d.doc}`} className="flex items-center justify-between py-2 text-sm">
                  <span><span className="font-medium text-primary">{d.plate}</span> <span className="text-muted">· {d.doc}</span></span>
                  <span className={days < 0 ? "font-medium text-[var(--error)]" : "text-[var(--warning)]"}>{days < 0 ? `expired ${-days}d ago` : `${days}d left`} · {short(d.date)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <Panel title="Last 7 days" icon={BedDouble} href="/accommodation/checkin">
        <ul className="space-y-1.5 text-sm">
          <li className="flex justify-between text-secondary"><span>Checked in</span><span className="tabular font-medium text-primary">{checkedIn}</span></li>
          <li className="flex justify-between text-secondary"><span>Checked out</span><span className="tabular font-medium text-primary">{checkedOut}</span></li>
        </ul>
      </Panel>
    </div>
  );
}

// ------------------------------------------------------------ timesheets

export async function TimesheetsExtras({ branchId }: { branchId: string | null }) {
  const bw = branchWhere(branchId);
  const now = new Date();
  const [waiting, today] = await Promise.all([
    prisma.timesheetEntry.groupBy({
      by: ["supplierId"],
      where: { ...bw, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } },
      _count: { _all: true },
      _min: { updatedAt: true },
      orderBy: { _count: { supplierId: "desc" } },
      take: 6,
    }),
    getAttendanceToday(branchId),
  ]);
  const suppliers = await prisma.supplier.findMany({ where: { id: { in: waiting.map((w) => w.supplierId) } }, select: { id: true, name: true } });
  const nameOf = new Map(suppliers.map((s) => [s.id, s.name]));
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Panel title="Waiting for approval, by supplier" icon={Receipt} href="/approvals?type=TIMESHEET" linkLabel="Approvals">
        {waiting.length === 0 ? (
          empty("Nothing is waiting for approval.")
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {waiting.map((w) => {
              const age = w._min.updatedAt ? Math.floor((now.getTime() - w._min.updatedAt.getTime()) / DAY) : 0;
              return (
                <li key={w.supplierId} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate text-primary">{nameOf.get(w.supplierId) ?? "Supplier"}</span>
                  <span className="tabular shrink-0 text-xs text-muted">{w._count._all} row{w._count._all === 1 ? "" : "s"} · oldest {age}d</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <Panel title="Attendance not marked today" icon={AlertTriangle} href="/attendance" linkLabel="Mark attendance">
        {today.expected === 0 ? (
          empty("No one is linked to a project yet.")
        ) : today.byProject.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--success)]">Everyone expected today has been marked.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {today.byProject.map((p) => (
              <li key={p.projectId} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate text-primary">{p.name}</span>
                <span className="tabular shrink-0 text-xs font-medium text-[var(--warning)]">{p.unmarked} of {p.expected} not marked</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

// -------------------------------------------------------------- partners

export async function PartnersExtras({ branchId, canBills }: { branchId: string | null; canBills: boolean }) {
  const bw = branchWhere(branchId);
  const now = new Date();
  const soon = new Date(now.getTime() + 60 * DAY);
  const [licences, money] = await Promise.all([
    prisma.supplier.findMany({
      where: { ...bw, status: "ACTIVE", tradeLicenseExpiry: { not: null, lte: soon } },
      select: { id: true, name: true, tradeLicenseExpiry: true },
      orderBy: { tradeLicenseExpiry: "asc" },
      take: 8,
    }),
    canBills ? getMoneySnapshot(branchId, { invoices: false, bills: true }) : null,
  ]);
  return (
    <div className={`grid grid-cols-1 gap-4 ${money ? "lg:grid-cols-2" : ""}`}>
      <Panel title="Supplier trade licences due" icon={AlertTriangle} href="/suppliers">
        {licences.length === 0 ? (
          empty("No supplier trade licence expires in the next 60 days.")
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {licences.map((s) => {
              const days = Math.ceil((s.tradeLicenseExpiry!.getTime() - now.getTime()) / DAY);
              return (
                <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                  <Link href={`/suppliers/${s.id}`} className="truncate text-primary hover:underline">{s.name}</Link>
                  <span className={`shrink-0 text-xs ${days < 0 ? "font-medium text-[var(--error)]" : "text-[var(--warning)]"}`}>{days < 0 ? `expired ${-days}d ago` : `${days}d left`}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      {money && (
        <Panel title="Supplier bills" icon={Receipt} href="/finance/bills" linkLabel="Bills">
          <ul className="space-y-1.5 text-sm">
            <li className="flex justify-between text-secondary"><span>Due in the next 7 days</span><span className="tabular font-medium text-primary">{aed(money.billsDueSoon.amount)} <span className="text-xs text-muted">({money.billsDueSoon.count})</span></span></li>
            <li className="flex justify-between text-secondary"><span>Overdue</span><span className={`tabular font-medium ${money.billsOverdue.count > 0 ? "text-[var(--error)]" : "text-primary"}`}>{aed(money.billsOverdue.amount)} <span className="text-xs text-muted">({money.billsOverdue.count})</span></span></li>
            <li className="flex justify-between text-secondary"><span>We owe in total</span><span className="tabular font-medium text-primary">{aed(money.owedToSuppliers)}</span></li>
          </ul>
        </Panel>
      )}
    </div>
  );
}

// ----------------------------------------------------------------- sales

export async function SalesExtras({ branchId }: { branchId: string | null }) {
  const bw = branchWhere(branchId);
  const since = new Date(new Date().getTime() - 90 * DAY);
  const [openQuotes, decided] = await Promise.all([
    prisma.quotation.findMany({
      where: { ...bw, status: { in: ["SENT", "NEGOTIATION", "APPROVED", "ACCEPTED"] } },
      select: { status: true, lines: { select: { quantity: true, rate: true } } },
    }),
    prisma.quotation.groupBy({ by: ["status"], where: { ...bw, createdAt: { gte: since }, status: { in: ["ACCEPTED", "CONVERTED", "REJECTED"] } }, _count: { _all: true } }),
  ]);
  const won = decided.filter((d) => d.status !== "REJECTED").reduce((n, d) => n + d._count._all, 0);
  const lost = decided.find((d) => d.status === "REJECTED")?._count._all ?? 0;
  const rate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;
  const byStatus = new Map<string, { count: number; workers: number; monthly: number }>();
  for (const q of openQuotes) {
    const cur = byStatus.get(q.status) ?? { count: 0, workers: 0, monthly: 0 };
    cur.count++;
    for (const l of q.lines) { cur.workers += l.quantity; cur.monthly += l.quantity * l.rate; }
    byStatus.set(q.status, cur);
  }
  const rows = [...byStatus.entries()];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="Open pipeline" href="/sales/quotations" className="lg:col-span-2">
        {rows.length === 0 ? (
          empty("No open quotations.")
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr><th className="py-2 pr-3 font-medium">Stage</th><th className="px-3 py-2 font-medium">Quotations</th><th className="px-3 py-2 font-medium">Workers</th><th className="py-2 pl-3 text-right font-medium">At quoted rates</th></tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map(([status, v]) => (
                <tr key={status}>
                  <td className="py-2 pr-3 text-primary">{status.charAt(0) + status.slice(1).toLowerCase()}</td>
                  <td className="tabular px-3 py-2 text-secondary">{v.count}</td>
                  <td className="tabular px-3 py-2 text-secondary">{v.workers}</td>
                  <td className="tabular py-2 pl-3 text-right font-medium text-primary">{aed(v.monthly)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <Panel title="Win rate, last 90 days" href="/sales/quotations">
        {rate === null ? (
          empty("No quotation has been decided yet.")
        ) : (
          <div>
            <p className="tabular text-3xl font-semibold text-primary">{rate}%</p>
            <p className="mt-1 text-xs text-muted">{won} won · {lost} lost</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

// --------------------------------------------------------------- billing

export async function BillingExtras({ branchId }: { branchId: string | null }) {
  const bw = branchWhere(branchId);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const since = new Date(now.getTime() - 90 * DAY);
  const [unpaid, collected, invoiced, paid] = await Promise.all([
    prisma.clientInvoice.findMany({ where: { ...bw, status: { in: ["SENT", "OVERDUE"] } }, select: { totalAmount: true, dueDate: true, issueDate: true } }),
    prisma.clientInvoice.aggregate({ where: { ...bw, status: "PAID", paidDate: { gte: monthStart } }, _sum: { totalAmount: true } }),
    prisma.clientInvoice.aggregate({ where: { ...bw, status: { not: "DRAFT" }, issueDate: { gte: monthStart } }, _sum: { totalAmount: true } }),
    prisma.clientInvoice.findMany({ where: { ...bw, status: "PAID", paidDate: { gte: since } }, select: { issueDate: true, paidDate: true } }),
  ]);
  const labels = ["Not yet due", "1–30 days late", "31–60 days late", "Over 60 days late"];
  const totals = [0, 0, 0, 0];
  for (const i of unpaid) {
    const due = i.dueDate ?? new Date(i.issueDate.getTime() + 30 * DAY);
    const late = Math.floor((now.getTime() - due.getTime()) / DAY);
    totals[late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : 3] += i.totalAmount;
  }
  const days = paid.filter((p) => p.paidDate).map((p) => (p.paidDate!.getTime() - p.issueDate.getTime()) / DAY);
  const avgDays = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Panel title="Unpaid invoices by age" icon={Receipt} href="/invoices/history" className="lg:col-span-2">
        {unpaid.length === 0 ? (
          empty("No unpaid invoices.")
        ) : (
          <BarList
            items={labels.map((l, i) => ({ key: l, label: l, value: Math.round(totals[i]), valueLabel: aed(totals[i]), tone: i === 0 ? "brand" : i === 1 ? "warning" : "danger" }))}
            emptyLabel=""
          />
        )}
      </Panel>
      <Panel title="This month">
        <ul className="space-y-1.5 text-sm">
          <li className="flex justify-between text-secondary"><span>Invoiced</span><span className="tabular font-medium text-primary">{aed(invoiced._sum.totalAmount ?? 0)}</span></li>
          <li className="flex justify-between text-secondary"><span>Collected</span><span className="tabular font-medium text-primary">{aed(collected._sum.totalAmount ?? 0)}</span></li>
          <li className="flex justify-between text-secondary"><span>Average days to be paid</span><span className="tabular font-medium text-primary">{avgDays === null ? "—" : `${avgDays} days`}</span></li>
        </ul>
        <p className="mt-2 text-[11px] text-subtle">Average is over invoices paid in the last 90 days.</p>
      </Panel>
    </div>
  );
}
