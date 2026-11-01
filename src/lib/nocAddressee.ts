import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";

export type Addressee = { id: string; name: string; address: string | null };

const addressOf = (s: { location: string | null; poBox: string | null }) =>
  [s.location, s.poBox ? `P.O. Box ${s.poBox}` : null].filter(Boolean).join(", ") || null;

/** Our own companies, the ones a NOC can be addressed to. */
export async function loadOwnCompanies(branchId: string | null): Promise<Addressee[]> {
  const rows = await prisma.supplier.findMany({
    where: { ...branchWhere(branchId), isOwnCompany: true },
    select: { id: true, name: true, fullName: true, location: true, poBox: true },
    orderBy: { name: "asc" },
  });
  return rows.map((s) => ({ id: s.id, name: s.fullName || s.name, address: addressOf(s) }));
}

/** The company a NOC is addressed to, or null (older NOCs, or one that is no longer ours) so the letter falls back to the client. */
export async function addresseeOf(id: string | null | undefined): Promise<{ name: string; address: string | null } | null> {
  if (!id) return null;
  const s = await prisma.supplier.findUnique({ where: { id }, select: { name: true, fullName: true, location: true, poBox: true, isOwnCompany: true } });
  if (!s || !s.isOwnCompany) return null;
  return { name: s.fullName || s.name, address: addressOf(s) };
}

/** Checks the chosen company is one of ours in this branch. Returns an error to show, or null. */
export async function checkAddressee(id: string | null, branchId: string | null): Promise<string | null> {
  const own = await loadOwnCompanies(branchId);
  if (own.length === 0) return null; // none set up yet: the letter is addressed to the client as before
  if (!id) return "Choose which of our companies the NOC is addressed to.";
  return own.some((c) => c.id === id) ? null : "That isn't one of our companies.";
}
