import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { VENDOR_COOKIE, VENDOR_DURATION_SECONDS, createVendorToken, verifyVendorToken } from "./token";

export async function setVendorCookie(supplierId: string) {
  (await cookies()).set(VENDOR_COOKIE, await createVendorToken(supplierId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VENDOR_DURATION_SECONDS,
  });
}

export async function clearVendorCookie() {
  (await cookies()).delete(VENDOR_COOKIE);
}

/** The signed-in supplier, re-checked every request so switching the portal off applies at once. */
export async function getVendor() {
  const token = (await cookies()).get(VENDOR_COOKIE)?.value;
  const session = token ? await verifyVendorToken(token) : null;
  if (!session) return null;
  const supplier = await prisma.supplier.findUnique({
    where: { id: session.supplierId },
    select: {
      id: true,
      name: true,
      fullName: true,
      code: true,
      branchId: true,
      portalEnabled: true,
      approvalStatus: true,
      labourApprovalStatus: true,
      invoiceApprovalStatus: true,
      contactPerson: true,
    },
  });
  if (!supplier || !supplier.portalEnabled) return null;
  return supplier;
}
