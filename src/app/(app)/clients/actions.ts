"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { logAudit } from "@/lib/audit";

// Every nested mutation (contacts, trade rates, documents) takes a clientId
// rather than looking the client up itself, so this is the one place that
// guards them all against acting on another branch's client.
async function assertClientInBranch(clientId: string, branchId: string | null, isSuperAdmin: boolean) {
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { branchId: true } });
  return !!client && !isOutsideBranch(client.branchId, branchId, isSuperAdmin);
}

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

function billingFields(formData: FormData) {
  const billingType = String(formData.get("billingType") || "");
  const billingRate = numberOrNull(formData.get("billingRate"));
  return {
    basicRate: billingType === "BASIC" ? billingRate : null,
    hourlyRate: billingType === "HOURLY" ? billingRate : null,
  };
}

export async function createClientAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Company name is required." };
  if (!branchId) {
    return {
      error: isSuperAdmin
        ? "Pick a branch from the switcher before adding a client."
        : "Your account has no branch assigned — contact an admin.",
    };
  }

  const existing = await prisma.client.findUnique({ where: { name } });
  if (existing) return { error: "A client with that name already exists." };

  const data = {
    name,
    code: await nextClientCode(),
    branchId,
    contactPerson: stringOrNull(formData.get("contactPerson")),
    contactEmail: stringOrNull(formData.get("contactEmail")),
    contactPhone: stringOrNull(formData.get("contactPhone")),
    ...billingFields(formData),
    contractStart: dateOrNull(formData.get("contractStart")),
    contractEnd: dateOrNull(formData.get("contractEnd")),
    status: String(formData.get("status") || "ACTIVE"),
  };

  const client = await prisma.client.create({ data });

  await logAudit({
    entityType: "CLIENT",
    entityId: client.id,
    action: "CREATE",
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClientAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("clientId") || "");
  if (!id) return;
  if (!(await assertClientInBranch(id, branchId, isSuperAdmin))) return;

  const before = await prisma.client.findUnique({ where: { id } });

  const data = {
    contactPerson: stringOrNull(formData.get("contactPerson")),
    contactEmail: stringOrNull(formData.get("contactEmail")),
    contactPhone: stringOrNull(formData.get("contactPhone")),
    ...billingFields(formData),
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
    country: stringOrNull(formData.get("country")),
    emirate: stringOrNull(formData.get("emirate")),
    website: stringOrNull(formData.get("website")),
    fax: stringOrNull(formData.get("fax")),
    poBox: stringOrNull(formData.get("poBox")),
    paymentSchedule: stringOrNull(formData.get("paymentSchedule")),
    account: stringOrNull(formData.get("account")),
    vendorCode: stringOrNull(formData.get("vendorCode")),
    customer: stringOrNull(formData.get("customer")),
    currency: stringOrNull(formData.get("currency")),
    grades: stringOrNull(formData.get("grades")),
    telephone: stringOrNull(formData.get("telephone")),
  };

  await prisma.client.update({ where: { id }, data });

  await logAudit({
    entityType: "CLIENT",
    entityId: id,
    action: "UPDATE",
    before: before as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/clients/${id}`);
  revalidatePath("/clients");
}

export async function addClientContactAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!clientId || !name) return;
  if (!(await assertClientInBranch(clientId, branchId, isSuperAdmin))) return;

  await prisma.clientContact.create({
    data: {
      clientId,
      name,
      designation: stringOrNull(formData.get("designation")),
      phone: stringOrNull(formData.get("phone")),
      email: stringOrNull(formData.get("email")),
    },
  });

  revalidatePath(`/clients/${clientId}`);
}

export async function updateClientContactAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  const contactId = String(formData.get("contactId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!contactId || !name) return;
  if (!(await assertClientInBranch(clientId, branchId, isSuperAdmin))) return;

  await prisma.clientContact.update({
    where: { id: contactId },
    data: {
      name,
      designation: stringOrNull(formData.get("designation")),
      phone: stringOrNull(formData.get("phone")),
      email: stringOrNull(formData.get("email")),
    },
  });

  revalidatePath(`/clients/${clientId}`);
}

export async function removeClientContactAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  const contactId = String(formData.get("contactId") || "");
  if (!contactId) return;
  if (!(await assertClientInBranch(clientId, branchId, isSuperAdmin))) return;
  await prisma.clientContact.delete({ where: { id: contactId } });
  revalidatePath(`/clients/${clientId}`);
}

export async function addClientTradeRateAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  const trade = String(formData.get("trade") || "").trim();
  const rate = numberOrNull(formData.get("rate"));
  if (!clientId || !trade || rate == null) return;
  if (!(await assertClientInBranch(clientId, branchId, isSuperAdmin))) return;

  const existing = await prisma.clientTradeRate.findFirst({
    where: { clientId, projectId: null, trade },
  });
  if (existing) {
    await prisma.clientTradeRate.update({ where: { id: existing.id }, data: { rate } });
  } else {
    await prisma.clientTradeRate.create({ data: { clientId, trade, rate } });
  }

  revalidatePath(`/clients/${clientId}`);
}

export async function removeClientTradeRateAction(formData: FormData) {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  const rateId = String(formData.get("rateId") || "");
  if (!rateId) return;
  if (!(await assertClientInBranch(clientId, branchId, isSuperAdmin))) return;
  await prisma.clientTradeRate.delete({ where: { id: rateId } });
  revalidatePath(`/clients/${clientId}`);
}

export async function addClientDocumentAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  const type = String(formData.get("type") || "OTHER");
  const expiryDate = dateOrNull(formData.get("expiryDate"));
  const file = formData.get("file");
  if (!clientId || !(file instanceof File) || file.size === 0) return;
  if (file.size > MAX_UPLOAD_BYTES) return;
  if (!(await assertClientInBranch(clientId, branchId, isSuperAdmin))) return;

  const buffer = Buffer.from(await file.arrayBuffer());
  const created = await prisma.clientDocument.create({
    data: {
      clientId,
      type,
      filename: file.name,
      fileData: buffer,
      mimeType: file.type || "application/octet-stream",
      expiryDate,
      uploadedById: user.id,
    },
  });

  await logAudit({
    entityType: "CLIENT_DOCUMENT",
    entityId: created.id,
    action: "CREATE",
    after: { clientId, type, filename: file.name, expiryDate },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/clients/${clientId}`);
}

export async function deleteClientDocumentAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("documentId") || "");
  const clientId = String(formData.get("clientId") || "");
  if (!id) return;
  if (!(await assertClientInBranch(clientId, branchId, isSuperAdmin))) return;

  const existing = await prisma.clientDocument.findUnique({ where: { id } });
  await prisma.clientDocument.delete({ where: { id } });

  if (existing) {
    await logAudit({
      entityType: "CLIENT_DOCUMENT",
      entityId: id,
      action: "DELETE",
      before: { clientId, type: existing.type, filename: existing.filename, expiryDate: existing.expiryDate },
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath(`/clients/${clientId}`);
}

export async function bulkImportClientsAction(rows: Record<string, string>[]) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const results: { row: number; status: "created" | "updated" | "error"; message?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = (r["Company name"] || "").trim();
    if (!name) {
      results.push({ row: i + 2, status: "error", message: "Company name is required." });
      continue;
    }
    if (!branchId) {
      results.push({ row: i + 2, status: "error", message: "No branch selected to import into." });
      continue;
    }
    try {
      const existing = await prisma.client.findUnique({ where: { name } });
      if (existing && isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) {
        results.push({ row: i + 2, status: "error", message: "That name belongs to a different branch." });
        continue;
      }
      const data = {
        contactPerson: stringOrNull(r["Contact person"] ?? null),
        contactEmail: stringOrNull(r["Contact email"] ?? null),
        contactPhone: stringOrNull(r["Contact phone"] ?? null),
        trn: stringOrNull(r["TRN"] ?? null),
        tradeLicenseNumber: stringOrNull(r["Trade license number"] ?? null),
      };
      if (existing) {
        const before = existing as unknown as Record<string, unknown>;
        await prisma.client.update({ where: { id: existing.id }, data });
        await logAudit({
          entityType: "CLIENT",
          entityId: existing.id,
          action: "UPDATE",
          before,
          after: data,
          userId: user.id,
          userName: user.name,
          branchId,
        });
        results.push({ row: i + 2, status: "updated" });
      } else {
        const created = await prisma.client.create({
          data: { name, code: await nextClientCode(), branchId, ...data },
        });
        await logAudit({
          entityType: "CLIENT",
          entityId: created.id,
          action: "CREATE",
          after: { name, ...data },
          userId: user.id,
          userName: user.name,
          branchId,
        });
        results.push({ row: i + 2, status: "created" });
      }
    } catch (e) {
      results.push({
        row: i + 2,
        status: "error",
        message: e instanceof Error ? e.message : "Failed to import row.",
      });
    }
  }

  revalidatePath("/clients");
  return results;
}

export async function deleteClientAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("clientId") || "");
  if (!id) return;
  if (!(await assertClientInBranch(id, branchId, isSuperAdmin))) return;

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

  const existing = await prisma.client.findUnique({ where: { id } });
  await prisma.client.delete({ where: { id } });

  if (existing) {
    await logAudit({
      entityType: "CLIENT",
      entityId: id,
      action: "DELETE",
      before: existing as unknown as Record<string, unknown>,
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath("/clients");
  redirect("/clients");
}

/**
 * Deletes a selection, skipping any client that's still referenced.
 *
 * The lists have had row selection all along, but the only thing selecting
 * changed was the Export button's label. Refusals are reported per client
 * rather than failing the whole batch, since a mixed selection is normal.
 */
export async function deleteClientsAction(
  ids: string[]
): Promise<{ deleted: number; blocked: { name: string; reason: string }[] }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const blocked: { name: string; reason: string }[] = [];
  let deleted = 0;

  for (const id of ids) {
    if (!(await assertClientInBranch(id, branchId, isSuperAdmin))) continue;
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) continue;

    const [entryCount, projectCount] = await Promise.all([
      prisma.timesheetEntry.count({ where: { clientId: id } }),
      prisma.project.count({ where: { clientId: id } }),
    ]);
    if (entryCount > 0 || projectCount > 0) {
      const parts: string[] = [];
      if (entryCount > 0) parts.push(`${entryCount} timesheet row(s)`);
      if (projectCount > 0) parts.push(`${projectCount} project(s)`);
      blocked.push({ name: existing.name, reason: parts.join(" and ") });
      continue;
    }

    await prisma.client.delete({ where: { id } });
    deleted += 1;
    await logAudit({
      entityType: "CLIENT",
      entityId: id,
      action: "DELETE",
      before: existing as unknown as Record<string, unknown>,
      userId: user.id,
      userName: user.name,
      branchId,
    });
  }

  revalidatePath("/clients");
  return { deleted, blocked };
}
