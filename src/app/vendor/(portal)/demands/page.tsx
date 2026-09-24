import Link from "next/link";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { Badge, type BadgeColor } from "@/components/Badge";

export const metadata = { title: "Demands" };
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const STATUS: Record<string, { label: string; color: BadgeColor }> = {
  SENT: { label: "Awaiting your reply", color: "amber" },
  ACCEPTED: { label: "You accepted", color: "green" },
  DECLINED: { label: "You declined", color: "slate" },
};
const FILTERS = [{ k: "", l: "All" }, { k: "SENT", l: "Awaiting reply" }, { k: "ACCEPTED", l: "Accepted" }, { k: "DECLINED", l: "Declined" }];

/** Manpower requests we have sent to this supplier. Client and project names are deliberately not shown. */
export default async function VendorDemandsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const vendor = (await getVendor())!;
  const { status = "" } = await searchParams;
  const offers = await prisma.demandSupplierOffer.findMany({
    where: { supplierId: vendor.id, ...(FILTERS.some((f) => f.k && f.k === status) ? { status } : {}) },
    orderBy: [{ status: "asc" }, { sentAt: "desc" }],
    include: { demandRequest: { select: { requestNo: true, requestType: true, status: true, trades: { select: { trade: true, quantity: true } } } } },
  });
  const waiting = await prisma.demandSupplierOffer.count({ where: { supplierId: vendor.id, status: "SENT" } });

  return (
    <>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-primary">Demands</h1>
        <p className="mt-1 text-sm text-muted">Manpower we have asked you to supply. Accept with your quote, or decline with a reason.</p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter">
        {FILTERS.map((f) => (
          <Link key={f.k || "all"} href={f.k ? `/vendor/demands?status=${f.k}` : "/vendor/demands"} role="tab" aria-selected={status === f.k}
            className={status === f.k ? "rounded-md bg-brand-soft px-3 py-1.5 text-sm font-medium text-[var(--brand-primary)]" : "rounded-md px-3 py-1.5 text-sm text-secondary hover:bg-surface-hover"}>
            {f.l}{f.k === "SENT" && waiting > 0 && <span className="ml-1.5 rounded-full bg-[var(--warning-soft)] px-1.5 text-xs text-[var(--warning)]">{waiting}</span>}
          </Link>
        ))}
      </div>
      {offers.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">{status ? "Nothing here." : "No requests have been sent to you yet. When we need workers, they appear here."}</div>
      ) : (
        <ul className="card divide-y divide-[var(--border)]">
          {offers.map((o) => {
            const total = o.demandRequest.trades.reduce((s, t) => s + t.quantity, 0);
            const closed = o.demandRequest.status === "Closed" || o.demandRequest.status === "Rejected";
            return (
              <li key={o.id}>
                <Link href={`/vendor/demands/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition hover:bg-surface-hover">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary">Request #{o.demandRequest.requestNo} <span className="font-normal text-muted">· {o.demandRequest.requestType}</span></p>
                    <p className="mt-0.5 truncate text-xs text-muted">{o.demandRequest.trades.map((t) => `${t.quantity} ${t.trade}`).join(" · ")} — {total} worker{total === 1 ? "" : "s"} in total</p>
                    <p className="text-xs text-subtle">Sent {day(o.sentAt)}</p>
                  </div>
                  {closed && o.status === "SENT" ? <Badge color="slate">Closed</Badge> : <Badge color={STATUS[o.status]?.color ?? "slate"} dot>{STATUS[o.status]?.label ?? o.status}</Badge>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
