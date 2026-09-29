import { prisma } from "@/lib/db";

/** The sections of a module dashboard this person has switched off. */
export async function getHiddenSections(userId: string, module: string): Promise<Set<string>> {
  const pref = await prisma.dashboardPreference.findUnique({ where: { userId }, select: { hiddenWidgets: true } });
  const prefix = `${module}:`;
  return new Set((pref?.hiddenWidgets ?? []).filter((id) => id.startsWith(prefix)).map((id) => id.slice(prefix.length)));
}
