"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { approverIds, notifyUsers } from "@/lib/notifications/notify";
import { assertContactsValid } from "@/lib/validators";

type State = { error: string | null; ok?: boolean };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** The offer, only if it is this supplier's and still waiting for an answer. */
async function openOffer(offerId: string) {
  const vendor = await getVendor();
  if (!vendor) return { ok: false as const, error: "Please sign in again." };
  const offer = await prisma.demandSupplierOffer.findFirst({
    where: { id: offerId, supplierId: vendor.id },
    include: { demandRequest: { include: { trades: true } } },
  });
  if (!offer) return { ok: false as const, error: "That request wasn't found." };
  if (offer.status !== "SENT") return { ok: false as const, error: "You have already answered this request." };
  if (offer.demandRequest.status === "Closed" || offer.demandRequest.status === "Rejected") return { ok: false as const, error: "This request has been closed." };
  return { ok: true as const, vendor, offer };
}

async function tellOffice(demand: { requestNo: number; branchId: string }, supplierName: string, title: string, body: string) {
  await notifyUsers({
    userIds: await approverIds("demand", demand.branchId),
    kind: "DEMAND_SUPPLIER_REPLY",
    title,
    body: `${supplierName} — ${body}`,
    href: `/demand`,
  });
}

/** Accept a demand with a quote: how many workers per trade and at what rate. */
export async function acceptOfferAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const found = await openOffer(str(formData.get("offerId")));
  if (!found.ok) return { error: found.error };
  const { vendor, offer } = found;

  const lines = offer.demandRequest.trades.flatMap((t) => {
    const qty = Math.trunc(Number(str(formData.get(`qty_${t.id}`)) || 0));
    if (!(qty > 0)) return [];
    const rateRaw = str(formData.get(`rate_${t.id}`));
    const rate = rateRaw === "" ? null : Number(rateRaw);
    return [{ trade: t, qty, rate }];
  });
  if (lines.length === 0) return { error: "Enter how many workers you can supply for at least one trade, or decline the request." };
  for (const l of lines) {
    if (l.qty > l.trade.quantity) return { error: `${l.trade.trade}: you were asked for ${l.trade.quantity}, so you can't offer ${l.qty}.` };
    if (l.rate !== null && (!Number.isFinite(l.rate) || l.rate < 0)) return { error: `${l.trade.trade}: enter a valid rate, or leave it blank.` };
  }

  await prisma.$transaction([
    prisma.demandOfferLine.createMany({ data: lines.map((l) => ({ offerId: offer.id, demandRequestTradeId: l.trade.id, quantity: l.qty, rate: l.rate })) }),
    prisma.demandSupplierOffer.update({ where: { id: offer.id }, data: { status: "ACCEPTED", note: str(formData.get("note")) || null, respondedAt: new Date() } }),
  ]);
  const total = lines.reduce((s, l) => s + l.qty, 0);
  await tellOffice(offer.demandRequest, vendor.name, `Supplier accepted request #${offer.demandRequest.requestNo}`, `offers ${total} worker${total === 1 ? "" : "s"}.`);
  revalidatePath("/vendor/demands");
  revalidatePath("/vendor");
  return { error: null, ok: true };
}

export async function declineOfferAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const found = await openOffer(str(formData.get("offerId")));
  if (!found.ok) return { error: found.error };
  const { vendor, offer } = found;
  const note = str(formData.get("note"));
  if (!note) return { error: "Tell us why you're declining, so we can plan around it." };

  await prisma.demandSupplierOffer.update({ where: { id: offer.id }, data: { status: "DECLINED", note, respondedAt: new Date() } });
  await tellOffice(offer.demandRequest, vendor.name, `Supplier declined request #${offer.demandRequest.requestNo}`, `reason: ${note}`);
  revalidatePath("/vendor/demands");
  revalidatePath("/vendor");
  return { error: null, ok: true };
}
