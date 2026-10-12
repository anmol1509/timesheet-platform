import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

type Hit = { id: string; name: string; employeeIdNo: string };
const digitsOnly = (s: string) => s.replace(/\D/g, "");
const label = (h: Hit) => `${h.name} (${h.employeeIdNo})`;

/**
 * Other workers already holding the same identity number, mobile or bank account, as plain-language warnings.
 * Only the fields passed are looked up, so an edit that didn't touch them costs nothing. Comparison ignores
 * spaces, dashes and case, since the same number is typed many ways.
 */
export async function employeeDuplicates(f: { emiratesId?: string | null; passportNumber?: string | null; mobileNumber?: string | null; iban?: string | null; excludeId?: string | null }): Promise<string[]> {
  const out: string[] = [];
  const not = f.excludeId ? Prisma.sql`AND id <> ${f.excludeId}` : Prisma.empty;
  const find = (column: "emiratesId" | "passportNumber" | "mobileNumber" | "wpsIban", test: Prisma.Sql) =>
    prisma.$queryRaw<Hit[]>(Prisma.sql`SELECT id, name, "employeeIdNo" FROM "Employee" WHERE ${Prisma.raw(`"${column}"`)} IS NOT NULL AND ${test} ${not} LIMIT 3`);

  if (f.emiratesId && digitsOnly(f.emiratesId).length === 15) {
    const d = digitsOnly(f.emiratesId);
    const hits = await find("emiratesId", Prisma.sql`regexp_replace("emiratesId", '\\D', '', 'g') = ${d}`);
    if (hits.length) out.push(`This Emirates ID already belongs to ${hits.map(label).join(", ")}.`);
  }
  if (f.passportNumber && f.passportNumber.replace(/\s/g, "").length >= 6) {
    const p = f.passportNumber.replace(/\s/g, "").toUpperCase();
    const hits = await find("passportNumber", Prisma.sql`upper(regexp_replace("passportNumber", '\\s', '', 'g')) = ${p}`);
    if (hits.length) out.push(`This passport number is already on ${hits.map(label).join(", ")}.`);
  }
  if (f.mobileNumber && digitsOnly(f.mobileNumber).length >= 9) {
    const tail = digitsOnly(f.mobileNumber).slice(-9);
    const hits = await find("mobileNumber", Prisma.sql`right(regexp_replace("mobileNumber", '\\D', '', 'g'), 9) = ${tail}`);
    if (hits.length) out.push(`This mobile number is already used by ${hits.map(label).join(", ")}.`);
  }
  if (f.iban && f.iban.replace(/\s/g, "").length >= 15) {
    const i = f.iban.replace(/\s/g, "").toUpperCase();
    const hits = await find("wpsIban", Prisma.sql`upper(regexp_replace("wpsIban", '\\s', '', 'g')) = ${i}`);
    if (hits.length) out.push(`This bank account (IBAN) is already on ${hits.map(label).join(", ")}. Two workers sharing one account is usually a mistake.`);
  }
  return out;
}

/** Another supplier (or client) in the same company already carrying this TRN or trade licence number. */
export async function partnerDuplicates(kind: "supplier" | "client", f: { trn?: string | null; tradeLicenseNumber?: string | null; excludeId: string; branchId: string | null }): Promise<string[]> {
  const out: string[] = [];
  const table = kind === "supplier" ? "Supplier" : "Client";
  const noun = kind === "supplier" ? "supplier" : "client";
  const scope = f.branchId ? Prisma.sql`AND "branchId" = ${f.branchId}` : Prisma.empty;
  const find = (column: "trn" | "tradeLicenseNumber", value: string) =>
    prisma.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`SELECT id, name FROM ${Prisma.raw(`"${table}"`)} WHERE ${Prisma.raw(`"${column}"`)} IS NOT NULL AND upper(regexp_replace(${Prisma.raw(`"${column}"`)}, '\\s', '', 'g')) = ${value} AND id <> ${f.excludeId} ${scope} LIMIT 3`);
  if (f.trn && f.trn.replace(/\s/g, "").length >= 10) {
    const hits = await find("trn", f.trn.replace(/\s/g, "").toUpperCase());
    if (hits.length) out.push(`This TRN is already on the ${noun} ${hits.map((h) => h.name).join(", ")}.`);
  }
  if (f.tradeLicenseNumber && f.tradeLicenseNumber.replace(/\s/g, "").length >= 4) {
    const hits = await find("tradeLicenseNumber", f.tradeLicenseNumber.replace(/\s/g, "").toUpperCase());
    if (hits.length) out.push(`This trade licence number is already on the ${noun} ${hits.map((h) => h.name).join(", ")}.`);
  }
  return out;
}
