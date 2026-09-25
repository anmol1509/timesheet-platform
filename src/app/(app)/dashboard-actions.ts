"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { assertContactsValid } from "@/lib/validators";

export async function saveDashboardPreferenceAction(formData: FormData) {
  assertContactsValid(formData);
  const user = await requireUser();
  const hiddenWidgets = formData.getAll("hiddenWidgets").map(String);
  const widgetOrder = formData.getAll("widgetOrder").map(String);

  await prisma.dashboardPreference.upsert({
    where: { userId: user.id },
    update: { hiddenWidgets, widgetOrder },
    create: { userId: user.id, hiddenWidgets, widgetOrder },
  });

  revalidatePath("/");
}
