"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function numberOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function dateOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s ? new Date(s) : null;
}

function stringOrNull(value: FormDataEntryValue | null) {
  const s = String(value || "").trim();
  return s || null;
}

async function nextClientCode() {
  const count = await prisma.client.count();
  return `CLI${String(count + 1).padStart(3, "0")}`;
}

export async function createClientAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  await requireUser();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Company name is required." };

  const existing = await prisma.client.findUnique({ where: { name } });
  if (existing) return { error: "A client with that name already exists." };

  const client = await prisma.client.create({
    data: {
      name,
      code: await nextClientCode(),
      contactPerson: stringOrNull(formData.get("contactPerson")),
      contactEmail: stringOrNull(formData.get("contactEmail")),
      contactPhone: stringOrNull(formData.get("contactPhone")),
      basicRate: numberOrNull(formData.get("basicRate")),
      hourlyRate: numberOrNull(formData.get("hourlyRate")),
      contractStart: dateOrNull(formData.get("contractStart")),
      contractEnd: dateOrNull(formData.get("contractEnd")),
      status: String(formData.get("status") || "ACTIVE"),
    },
  });

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClientAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("clientId") || "");
  if (!id) return;

  await prisma.client.update({
    where: { id },
    data: {
      contactPerson: stringOrNull(formData.get("contactPerson")),
      contactEmail: stringOrNull(formData.get("contactEmail")),
      contactPhone: stringOrNull(formData.get("contactPhone")),
      basicRate: numberOrNull(formData.get("basicRate")),
      hourlyRate: numberOrNull(formData.get("hourlyRate")),
      contractStart: dateOrNull(formData.get("contractStart")),
      contractEnd: dateOrNull(formData.get("contractEnd")),
      status: String(formData.get("status") || "ACTIVE"),
      trn: stringOrNull(formData.get("trn")),
      tradeLicenseNumber: stringOrNull(formData.get("tradeLicenseNumber")),
      tradeLicenseExpiry: dateOrNull(formData.get("tradeLicenseExpiry")),
      billingAddress: stringOrNull(formData.get("billingAddress")),
      paymentTerms: stringOrNull(formData.get("paymentTerms")),
      retentionPercent: numberOrNull(formData.get("retentionPercent")),
      secondContactName: stringOrNull(formData.get("secondContactName")),
      secondContactPhone: stringOrNull(formData.get("secondContactPhone")),
      secondContactEmail: stringOrNull(formData.get("secondContactEmail")),
    },
  });

  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}

export async function deleteClientAction(formData: FormData) {
  await requireUser();
  const id = String(formData.get("clientId") || "");
  if (!id) return;

  const [entryCount, projectCount] = await Promise.all([
    prisma.timesheetEntry.count({ where: { clientId: id } }),
    prisma.project.count({ where: { clientId: id } }),
  ]);
  if (entryCount > 0 || projectCount > 0) {
    const parts: string[] = [];
    if (entryCount > 0) parts.push(`${entryCount} timesheet row(s)`);
    if (projectCount > 0) parts.push(`${projectCount} project(s)`);
    redirect(
      `/clients/${id}?error=${encodeURIComponent(
        `Can't delete — still linked to ${parts.join(" and ")}. Remove those first.`
      )}`
    );
  }

  await prisma.client.delete({ where: { id } });
  revalidatePath("/clients");
  redirect("/clients");
}
