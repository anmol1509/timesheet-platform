import Link from "next/link";
import { AlertTriangle, FileText, Inbox, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { Badge, type BadgeColor } from "@/components/Badge";
import { KpiStrip } from "@/components/KpiStrip";
import { billTotals } from "@/lib/payables";
import { cn } from "@/lib/cn";

export const metadata = { title: "Supplier portal" };
const aed = (n: number) => n.toLocaleString("en-AE", { maximumFractionDigits: 0 });
const APPROVAL: Record<string, BadgeColor> = { Approved: "green", Pending: "amber", Rejected: "red" };
const DAY = 86_400_000;
const DOCS = [
  ["Visa", "visaExpiry"], ["Labour card", "laborCardExpiry"], ["Medical", "medicalExpiry"], ["Passport", "passportExpiry"], ["Emirates ID", "emiratesIdExpiry"],
] as const;

type Item = { key: string; href: string; icon: typeof Inbox; title: string; sub: string; tone: "danger" | "warning" };

export default async function VendorHome() {
  const vendor = (await getVendor())!;
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * DAY);
  const [workers, offers, bills, expiring] = await Promise.all([
    prisma.employee.groupBy({ by: ["status"], where: { supplierId: vendor.id, status: { not: "TERMINATED" } }, _count: true }),
    prisma.demandSupplierOffer.findMany({
      where: { supplierId: vendor.id, status: "SENT", demandRequest: { status: { notIn: ["Closed", "Rejected"] } } },
      orderBy: { sentAt: "desc" },
      select: { id: true, demandRequest: { select: { requestNo: true, trades: { select: { trade: true, quantity: true } } } } },
    }),
    prisma.supplierBill.findMany({ where: { supplierId: vendor.id }, include: { payments: { select: { amount: true } } } }),
    prisma.employee.findMany({
      where: {
        supplierId: vendor.id,
        status: { not: "TERMINATED" },
        OR: DOCS.map(([, f]) => ({ [f]: { lte: soon } })),
      },
      select: { id: true, name: true, employeeIdNo: true, visaExpiry: true, laborCardExpiry: true, medicalExpiry: true, passportExpiry: true, emiratesIdExpiry: true },
    }),
  ]);

  const totalWorkers = workers.reduce((s, w) => s + w._count, 0);
  const active = workers.find((w) => w.status === "ACTIVE")?._count ?? 0;
  const approved = bills.filter((b) => b.approvalStatus === "APPROVED");
  const owed = approved.reduce((s, b) => s + billTotals({ amount: Number(b.amount), vatAmount: Number(b.vatAmount) }, b.payments.map((p) => ({ amount: Number(p.amount) }))).balance, 0);
  const awaiting = bills.filter((b) => b.approvalStatus === "PENDING").length;
  const rejected = bills.filter((b) => b.approvalStatus === "REJECTED");

  // The soonest-expiring document per worker, worst first.
  const docIssues = expiring
    .map((w) => {
      let worst: { label: string; date: Date } | null = null;
      for (const [label, field] of DOCS) {
        const date = w[field];
        if (date && date <= soon && (!worst || date < worst.date)) worst = { label, date };
      }
      return { w, worst, days: worst ? Math.ceil((worst.date.getTime() - now.getTime()) / DAY) : 0 };
    })
    .filter((x): x is { w: (typeof expiring)[number]; worst: { label: string; date: Date }; days: number } => x.worst !== null)
    .sort((a, b) => a.days - b.days);

  const items: Item[] = [
    ...offers.slice(0, 4).map((o): Item => ({
      key: `o-${o.id}`, href: `/vendor/demands/${o.id}`, icon: Inbox, tone: "warning",
      title: `Request #${o.demandRequest.requestNo} is waiting for your reply`,
      sub: o.demandRequest.trades.map((t) => `${t.quantity} ${t.trade}`).join(" · "),
    })),
    ...rejected.slice(0, 3).map((b): Item => ({
      key: `b-${b.id}`, href: "/vendor/payments", icon: FileText, tone: "danger",
      title: `Invoice ${b.billNo} was rejected`, sub: b.approvalNote ?? "Correct it and resubmit.",
    })),
    ...docIssues.slice(0, 5).map(({ w, worst, days }): Item => ({
      key: `d-${w.id}`, href: "/vendor/workers", icon: AlertTriangle, tone: days < 0 ? "danger" : "warning",
      title: `${w.name} — ${worst.label} ${days < 0 ? `expired ${Math.abs(days)} days ago` : days === 0 ? "expires today" : `expires in ${days} days`}`, sub: w.employeeIdNo,
    })),
  ];

  return (
    <>
      <section className="card p-5">
        <p className="text-sm text-muted">Welcome</p>
        <h1 className="text-xl font-semibold tracking-tight text-primary">{vendor.fullName ?? vendor.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge color={APPROVAL[vendor.approvalStatus] ?? "slate"}>Supplier: {vendor.approvalStatus}</Badge>
          <Badge color={APPROVAL[vendor.labourApprovalStatus] ?? "slate"}>Labour: {vendor.labourApprovalStatus}</Badge>
          <Badge color={APPROVAL[vendor.invoiceApprovalStatus] ?? "slate"}>Invoicing: {vendor.invoiceApprovalStatus}</Badge>
        </div>
      </section>

      <KpiStrip
        cells={[
          { label: "Requests to answer", value: offers.length, href: "/vendor/demands?status=SENT", tone: offers.length > 0 ? "warning" : "success", sub: offers.length > 0 ? "waiting for your reply" : "all answered" },
          { label: "Your workers", value: totalWorkers, href: "/vendor/workers", sub: `${active} working` },
          { label: "Documents due", value: docIssues.length, href: "/vendor/workers", tone: docIssues.some((d) => d.days < 0) ? "danger" : docIssues.length > 0 ? "warning" : "success", sub: "workers, within 30 days" },
          { label: "Still owed to you", value: `AED ${aed(owed)}`, href: "/vendor/payments", sub: awaiting > 0 ? `${awaiting} invoice${awaiting === 1 ? "" : "s"} awaiting approval` : `across ${approved.length} approved invoice${approved.length === 1 ? "" : "s"}` },
        ]}
      />

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-default px-5 py-3">
          <h2 className="text-sm font-semibold text-primary">Needs your attention</h2>
          {items.length > 0 && <span className="text-xs text-subtle">{items.length} item{items.length === 1 ? "" : "s"}</span>}
        </div>
        {items.length === 0 ? (
          <div className="px-5 py-8 text-center"><Users className="mx-auto mb-2 h-5 w-5 text-[var(--success)]" aria-hidden /><p className="text-sm font-medium text-primary">You&apos;re all caught up</p><p className="mt-1 text-xs text-muted">No requests waiting, no rejected invoices, no documents about to expire.</p></div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {items.map((it) => (
              <li key={it.key}>
                <Link href={it.href} className="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-hover">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", it.tone === "danger" ? "bg-[var(--error-soft)] text-[var(--error)]" : "bg-[var(--warning-soft)] text-[var(--warning)]")}><it.icon className="h-4 w-4" aria-hidden /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-primary">{it.title}</span><span className="block truncate text-xs text-muted">{it.sub}</span></span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
