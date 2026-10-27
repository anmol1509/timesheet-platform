import { prisma } from "@/lib/db";
import type { EmailBrand } from "./layout";

export const PRODUCT_BRAND: EmailBrand = { name: "ManpowerSync" };

/** The base address emails link back to, with no trailing slash. */
export const appBaseUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

/** The company an email comes from: its name and, when it has uploaded one, its logo (served publicly for email programs). */
export async function brandForBranch(branchId: string | null | undefined): Promise<EmailBrand> {
  if (!branchId) return PRODUCT_BRAND;
  const b = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true, logoId: true } }).catch(() => null);
  if (!b) return PRODUCT_BRAND;
  const base = appBaseUrl();
  return { name: b.name, logoUrl: b.logoId && base ? `${base}/api/email-logo/${b.logoId}` : null };
}
