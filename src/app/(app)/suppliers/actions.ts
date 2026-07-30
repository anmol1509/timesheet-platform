"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

function dateOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s ? new Date(s) : null;
}

function numberOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

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

export async function updateSupplierAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("supplierId") || "");
  if (!id) return;

  await prisma.supplier.update({
    where: { id },
    data: {
      fullName: stringOrNull(formData.get("fullName")),
      status: String(formData.get("status") || "ACTIVE"),
      mohrePermitNumber: stringOrNull(formData.get("mohrePermitNumber")),
      tradeLicenseNumber: stringOrNull(formData.get("tradeLicenseNumber")),
      tradeLicenseExpiry: dateOrNull(formData.get("tradeLicenseExpiry")),
      contactPerson: stringOrNull(formData.get("contactPerson")),
      contactPhone: stringOrNull(formData.get("contactPhone")),
      contactEmail: stringOrNull(formData.get("contactEmail")),
      bankName: stringOrNull(formData.get("bankName")),
      iban: stringOrNull(formData.get("iban")),
      paymentTerms: stringOrNull(formData.get("paymentTerms")),
      payoutCycleStartDay: Math.min(
        31,
        Math.max(1, Number(formData.get("payoutCycleStartDay")) || 1)
      ),
      category: stringOrNull(formData.get("category")),
      previousId: stringOrNull(formData.get("previousId")),
      allowManualLabourId: formData.get("allowManualLabourId") === "on",
      overtime: formData.get("overtime") === "on",
      supplierAmountLimit: numberOrNull(formData.get("supplierAmountLimit")),
      pointOfContact: stringOrNull(formData.get("pointOfContact")),
      country: stringOrNull(formData.get("country")),
      emirate: stringOrNull(formData.get("emirate")),
      account: stringOrNull(formData.get("account")),
      bankAccountName: stringOrNull(formData.get("bankAccountName")),
      bankAccountNumber: stringOrNull(formData.get("bankAccountNumber")),
      bankCompany: stringOrNull(formData.get("bankCompany")),
      bankEmirate: stringOrNull(formData.get("bankEmirate")),
    },
  });

  revalidatePath(`/suppliers/${id}`);
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
