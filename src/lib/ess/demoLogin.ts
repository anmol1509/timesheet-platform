import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";

/**
 * Demo sign-in for the supplier and employee portals, for showing the product
 * without a real phone.
 *
 * It is deliberately narrow:
 *  - Off unless DEMO_LOGIN_CODE (six digits) is set in the environment. The code
 *    is never in the repository.
 *  - Only for DEMO_PHONE, a placeholder that is not a real mobile number, so no
 *    SMS is ever sent for it.
 *  - Only opens a record that is clearly marked as demo (a supplier named
 *    "DEMO ..." or an employee ID starting "DEMO-"), so it can never unlock a
 *    real supplier or employee, even if a real record is given this phone.
 *  - It still needs a code requested first, so the normal per-phone request and
 *    attempt limits apply to guessing it.
 */
export const DEMO_PHONE = "+9711234567890";

export const isDemoPhone = (e164: string | null | undefined) => e164 === DEMO_PHONE;

const configuredCode = () => {
  const c = process.env.DEMO_LOGIN_CODE ?? "";
  return /^\d{6}$/.test(c) ? c : null;
};

export const demoLoginEnabled = () => configuredCode() !== null;

/** Constant-time comparison against the configured demo code. False when demo login is off. */
export function demoCodeMatches(code: string): boolean {
  const expected = configuredCode();
  if (!expected || code.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(code), Buffer.from(expected));
}

/** True only for records explicitly marked as demo data. */
export async function isDemoPrincipal(kind: "EMPLOYEE" | "SUPPLIER", id: string): Promise<boolean> {
  if (kind === "SUPPLIER") {
    const s = await prisma.supplier.findUnique({ where: { id }, select: { name: true } });
    return !!s && s.name.startsWith("DEMO ");
  }
  const e = await prisma.employee.findUnique({ where: { id }, select: { employeeIdNo: true } });
  return !!e && e.employeeIdNo.startsWith("DEMO-");
}
