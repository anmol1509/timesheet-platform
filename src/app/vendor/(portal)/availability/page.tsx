import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { AvailabilityBoard } from "./availability-board";

export const metadata = { title: "Availability" };

export default async function VendorAvailabilityPage() {
  const vendor = (await getVendor())!;
  const today = new Date(); today.setUTCHours(0, 0, 0, 0);
  const [rows, skills] = await Promise.all([
    prisma.supplierAvailability.findMany({ where: { supplierId: vendor.id, date: { gte: today } }, orderBy: [{ date: "asc" }, { trade: "asc" }] }),
    prisma.skill.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <AvailabilityBoard
      trades={skills.map((s) => s.name)}
      rows={rows.map((r) => ({ id: r.id, trade: r.trade, date: r.date.toISOString().slice(0, 10), count: r.count, note: r.note }))}
    />
  );
}
