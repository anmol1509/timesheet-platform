"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function createSiteAction(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  await prisma.site.upsert({
    where: { name },
    update: {},
    create: { name },
  });

  revalidatePath("/sites");
}

export async function deleteSiteAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("siteId") || "");
  if (!id) return;
  await prisma.site.delete({ where: { id } });
  revalidatePath("/sites");
}
