"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function createSupplierAction(formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const fullName = String(formData.get("fullName") || "").trim() || null;

  const existing = await prisma.supplier.findUnique({ where: { name } });
  if (existing) {
    redirect(
      `/suppliers?error=${encodeURIComponent("A supplier with that name already exists.")}`
    );
  }

  await prisma.supplier.create({ data: { name, fullName } });
  revalidatePath("/suppliers");
}

export async function deleteSupplierAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("supplierId") || "");
  if (!id) return;

  const [entryCount, sheetCount] = await Promise.all([
    prisma.timesheetEntry.count({ where: { supplierId: id } }),
    prisma.generatedSheet.count({ where: { supplierId: id } }),
  ]);
  if (entryCount > 0 || sheetCount > 0) {
    const parts: string[] = [];
    if (entryCount > 0) parts.push(`${entryCount} timesheet row(s)`);
    if (sheetCount > 0) parts.push(`${sheetCount} generated sheet(s)`);
    redirect(
      `/suppliers?error=${encodeURIComponent(
        `Can't delete — still linked to ${parts.join(" and ")}.`
      )}`
    );
  }

  // Unassigning employees is reversible, unlike the timesheet/generated-sheet
  // history checked above, so it's safe to do automatically.
  await prisma.employee.updateMany({
    where: { supplierId: id },
    data: { supplierId: null },
  });
  await prisma.supplier.delete({ where: { id } });

  revalidatePath("/suppliers");
  revalidatePath("/employees");
}
