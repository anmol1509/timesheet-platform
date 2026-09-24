"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { parseDay } from "@/lib/dates";

type State = { error: string | null; ok?: boolean };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();

/** Declare manpower available: a trade, a day and a head count. */
export async function addAvailabilityAction(_prev: State, formData: FormData): Promise<State> {
  const vendor = await getVendor();
  if (!vendor) return { error: "Please sign in again." };
  const trade = str(formData.get("trade"));
  const date = parseDay(str(formData.get("date")));
  const count = Math.trunc(Number(str(formData.get("count"))));
  if (!trade || !(await prisma.skill.findUnique({ where: { name: trade }, select: { id: true } }))) return { error: "Choose a trade from the list." };
  if (!date) return { error: "Choose the date." };
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  if (date.getTime() < today.getTime()) return { error: "That date has already passed." };
  if (!Number.isFinite(count) || count < 1 || count > 1000) return { error: "Enter how many workers (1 to 1000)." };

  // One line per trade and day: adding again updates the count rather than doubling it.
  const existing = await prisma.supplierAvailability.findFirst({ where: { supplierId: vendor.id, trade, date } });
  if (existing) await prisma.supplierAvailability.update({ where: { id: existing.id }, data: { count, note: str(formData.get("note")) || null } });
  else await prisma.supplierAvailability.create({ data: { supplierId: vendor.id, branchId: vendor.branchId, trade, date, count, note: str(formData.get("note")) || null } });
  revalidatePath("/vendor/availability");
  return { error: null, ok: true };
}

export async function removeAvailabilityAction(formData: FormData): Promise<State> {
  const vendor = await getVendor();
  if (!vendor) return { error: "Please sign in again." };
  await prisma.supplierAvailability.deleteMany({ where: { id: str(formData.get("id")), supplierId: vendor.id } });
  revalidatePath("/vendor/availability");
  return { error: null, ok: true };
}
