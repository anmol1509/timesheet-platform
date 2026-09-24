import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { Badge } from "@/components/Badge";
import { RespondForm } from "./respond-form";

export const metadata = { title: "Request" };
const aed = (n: number) => n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });

export default async function VendorDemandDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const vendor = (await getVendor())!;
  const offer = await prisma.demandSupplierOffer.findFirst({
    where: { id, supplierId: vendor.id },
    include: {
      lines: true,
      demandRequest: { select: { requestNo: true, requestType: true, status: true, priority: true, trades: { select: { id: true, trade: true, quantity: true, shift: true }, orderBy: { trade: "asc" } } } },
    },
  });
  if (!offer) notFound();
  const d = offer.demandRequest;
  const closed = d.status === "Closed" || d.status === "Rejected";
  const answered = offer.status !== "SENT";
  const lineFor = new Map(offer.lines.map((l) => [l.demandRequestTradeId, l]));

  return (
    <>
      <div>
        <Link href="/vendor/demands" className="text-xs text-muted hover:text-secondary">← Demands</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-primary">Request #{d.requestNo}</h1>
          <Badge color={offer.status === "ACCEPTED" ? "green" : offer.status === "DECLINED" ? "slate" : "amber"} dot>
            {offer.status === "ACCEPTED" ? "You accepted" : offer.status === "DECLINED" ? "You declined" : "Awaiting your reply"}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted">{d.requestType} request · sent {day(offer.sentAt)}{d.priority ? ` · ${d.priority} priority` : ""}</p>
      </div>

      <section className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-default bg-surface-subtle text-left text-xs font-medium uppercase tracking-wide text-muted">
            <tr><th className="px-4 py-3">Trade</th><th className="px-3 py-3">Shift</th><th className="px-3 py-3 text-right">Requested</th>{answered && <><th className="px-3 py-3 text-right">You offered</th><th className="px-3 py-3 text-right">Your rate (AED)</th></>}</tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {d.trades.map((t) => {
              const l = lineFor.get(t.id);
              return (
                <tr key={t.id}>
                  <td className="px-4 py-3 font-medium text-primary">{t.trade}</td>
                  <td className="px-3 py-3 text-secondary">{t.shift ?? "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-secondary">{t.quantity}</td>
                  {answered && <><td className="px-3 py-3 text-right tabular-nums text-primary">{l ? l.quantity : "—"}</td><td className="px-3 py-3 text-right tabular-nums text-secondary">{l?.rate ? aed(Number(l.rate)) : "—"}</td></>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {answered ? (
        <section className="card p-5 text-sm">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{offer.status === "DECLINED" ? "Your reason" : "Your note"}</p>
          <p className="mt-1 text-secondary">{offer.note || "No note added."}</p>
          {offer.respondedAt && <p className="mt-3 text-xs text-subtle">Answered {day(offer.respondedAt)}. Our team will contact you about next steps.</p>}
        </section>
      ) : closed ? (
        <section className="card p-5 text-sm text-muted">This request has been closed, so it can no longer be answered.</section>
      ) : (
        <RespondForm offerId={offer.id} trades={d.trades.map((t) => ({ id: t.id, trade: t.trade, quantity: t.quantity }))} />
      )}
    </>
  );
}
