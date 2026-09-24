import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";

/** Marks one notification read, then goes where it points. Only portal paths are ever followed. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const vendor = await getVendor();
  if (!vendor) return NextResponse.redirect(new URL("/vendor/login", req.url));
  const { id } = await params;
  const n = await prisma.supplierNotification.findFirst({ where: { id, supplierId: vendor.id } });
  if (!n) return NextResponse.redirect(new URL("/vendor/notifications", req.url));
  if (!n.readAt) await prisma.supplierNotification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  const target = n.href && /^\/vendor(\/|$)/.test(n.href) && !n.href.includes("//") ? n.href : "/vendor/notifications";
  return NextResponse.redirect(new URL(target, req.url));
}
