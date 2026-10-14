"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const MODULES = ["workforce", "projects", "demand", "facilities", "timesheets", "business-partners", "sales", "billing"];

/** Saves which sections of one module dashboard this person has switched off. Stored beside the main dashboard's list as "module:section". */
export async function saveModuleSectionsAction(module: string, hidden: string[]) {
  if (!MODULES.includes(module)) return;
  const user = await requireUser();
  const clean = hidden.filter((id) => /^[a-z0-9-]{1,40}$/.test(id)).map((id) => `${module}:${id}`);
  const existing = await prisma.dashboardPreference.findUnique({ where: { userId: user.id } });
  const kept = (existing?.hiddenWidgets ?? []).filter((id) => !id.startsWith(`${module}:`));
  await prisma.dashboardPreference.upsert({
    where: { userId: user.id },
    update: { hiddenWidgets: [...kept, ...clean] },
    create: { userId: user.id, hiddenWidgets: clean, widgetOrder: [] },
  });
  revalidatePath(`/dashboards/${module}`);
}
