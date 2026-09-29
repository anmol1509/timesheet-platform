import { nameKey } from "@/lib/partyCode";
import type { Db } from "@/lib/importer/types";

// Spreadsheets spell the same thing many ways: "STEEL FIXER", "Steel Fixer ",
// "steel  fixer". An import should match what the platform already has rather
// than add a second copy, and when it must add something new, add it tidily.

const ACRONYMS = new Set(["MEP", "HVAC", "AC", "CCTV", "MIG", "TIG", "ELV", "HSE", "PRO", "QA", "QC", "CNC", "IT", "GRP", "PVC", "UPVC"]);

/** Trim and collapse spaces. A label typed entirely in capitals (or entirely in lower case) becomes Title Case; mixed case is left as the person wrote it. */
export function tidyLabel(raw: string): string {
  const s = raw.replace(/\s+/g, " ").trim();
  if (!s) return s;
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (!letters || (letters !== letters.toUpperCase() && letters !== letters.toLowerCase())) return s;
  return s
    .split(" ")
    .map((w) =>
      w
        .split("-")
        .map((p) => (ACRONYMS.has(p.toUpperCase()) ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
        .join("-")
    )
    .join(" ");
}

/** The spelling of a trade this branch already uses, or a tidied version of the new one. */
export type TradeCanon = (raw: string) => string;

export async function loadTradeCanon(db: Db, branchId: string): Promise<TradeCanon> {
  const known = new Map<string, string>();
  const add = (name: string | null | undefined) => {
    const label = (name ?? "").replace(/\s+/g, " ").trim();
    if (label && !known.has(nameKey(label))) known.set(nameKey(label), label);
  };
  // The trade catalogue is the official spelling; then what workers and sheets already carry.
  for (const s of await db.skill.findMany({ where: { OR: [{ branchId: null }, { branchId }] }, select: { name: true } })) add(s.name);
  for (const e of await db.employee.findMany({ where: { branchId, trade: { not: null } }, distinct: ["trade"], select: { trade: true } })) add(e.trade);
  for (const t of await db.timesheetEntry.findMany({ where: { branchId }, distinct: ["trade"], select: { trade: true } })) add(t.trade);
  return (raw: string) => {
    const label = raw.replace(/\s+/g, " ").trim();
    if (!label || label === "(unspecified)") return label || raw;
    const hit = known.get(nameKey(label));
    if (hit) return hit;
    const tidy = tidyLabel(label);
    known.set(nameKey(tidy), tidy); // the next row with the same new trade agrees with this one
    return tidy;
  };
}
