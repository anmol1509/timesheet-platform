import { prisma } from "@/lib/db";
import { visibleSkillWhere } from "@/lib/skillScope";
import { mergeTradeNames } from "@/lib/tradeNames";

/** The trade names for this company's dropdowns: the built-in trades plus the shared and company-added ones from the Trades page. */
export async function loadTradeNames(branchId: string | null): Promise<string[]> {
  const rows = await prisma.skill.findMany({ where: visibleSkillWhere(branchId), select: { name: true } });
  return mergeTradeNames(rows.map((r) => r.name));
}
