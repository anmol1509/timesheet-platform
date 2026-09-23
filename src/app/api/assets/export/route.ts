import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { branchWhere } from "@/lib/branch";
import { can } from "@/lib/permissions";
import { toCsv } from "@/lib/csvExport";
import { depreciation } from "@/lib/depreciation";

export async function GET() {
  const { user, branchId } = await requireUserWithBranch();
  if (!can(subjectOf(user), "assets", "export")) return NextResponse.json({ error: "You don't have permission to export assets." }, { status: 403 });
  const assets = await prisma.asset.findMany({ where: branchWhere(branchId), orderBy: { code: "asc" } });
  const today = new Date();
  const csv = toCsv(["Code", "Name", "Category", "Serial", "Location", "Purchased", "Cost", "Salvage", "Life (months)", "Monthly dep.", "Accumulated dep.", "Net book value", "Status", "Disposed on", "Proceeds"],
    assets.map((a) => { const d = depreciation({ cost: Number(a.cost), salvageValue: Number(a.salvageValue), usefulLifeMonths: a.usefulLifeMonths, purchaseDate: a.purchaseDate, disposedOn: a.disposedOn }, today); return [a.code, a.name, a.category, a.serialNo, a.location, a.purchaseDate.toISOString().slice(0, 10), Number(a.cost), Number(a.salvageValue), a.usefulLifeMonths, d.monthlyCharge, d.accumulated, d.bookValue, a.status, a.disposedOn?.toISOString().slice(0, 10), a.disposalValue ? Number(a.disposalValue) : ""]; }));
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="asset-register-${today.toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
