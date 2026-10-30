"use server";

import { isUniqueClash, uniqueClashMessage } from "@/lib/uniqueGuard";
import { otherDocFilename } from "@/lib/otherDoc";
import { findClientByName, uniqueClientCode } from "@/lib/entityCode";
import { normalizeCode } from "@/lib/partyCode";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission, requireView, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";
import { describeContact, logAudit, logChildChange } from "@/lib/audit";
import { checkPartner } from "@/lib/dataChecks";
import { partnerDuplicates } from "@/lib/duplicateCheck";
import { assertContactsValid } from "@/lib/validators";

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
  await requireWrite("partners.clients");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "Company name is required." };
  if (!branchId) {
    return {
      error: isSuperAdmin
        ? "Sign in as a company administrator before adding a client."
        : "Your account has no company assigned. Contact an admin.",
    };
  }

  // Names are unique within a branch: several suppliers share the same big clients.
  const existing = await findClientByName(name, branchId);
  if (existing) return { error: "A client with that name already exists." };

  // A code typed into the form wins; blank means "generate it from the name".
  const typed = normalizeCode(String(formData.get("code") || ""));
  if (typed && (await prisma.client.findFirst({ where: { branchId, code: typed }, select: { id: true } }))) {
    return { error: `The code ${typed} is already used by another client.` };
  }

  const data = {
    name,
    code: typed || (await uniqueClientCode(name, branchId)),
    branchId,
    contactPerson: stringOrNull(formData.get("contactPerson")),
    contactEmail: stringOrNull(formData.get("contactEmail")),
    contactPhone: stringOrNull(formData.get("contactPhone")),
    ...billingFields(formData),
    contractStart: dateOrNull(formData.get("contractStart")),
    contractEnd: dateOrNull(formData.get("contractEnd")),
    status: String(formData.get("status") || "ACTIVE"),
  };

  let client;
  try {
    client = await prisma.client.create({ data });
  } catch (e) {
    if (isUniqueClash(e)) return { error: uniqueClashMessage(e) };
    throw e;
  }

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

export async function updateClientAction(formData: FormData): Promise<{ error: string | null; warnings?: string[] }> {
  await requireWrite("partners.clients");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("clientId") || "");
  if (!id) return { error: null };
  if (!(await assertClientInBranch(id, branchId, isSuperAdmin))) return { error: null };

  const before = await prisma.client.findUnique({ where: { id } });
  if (!before) return { error: null };

  // Blank keeps the current code (or makes one if the client never had one).
  const typedCode = normalizeCode(String(formData.get("code") || ""));
  const code = typedCode || before.code || (await uniqueClientCode(before.name, before.branchId!));
  if (code !== before.code) {
    const clash = await prisma.client.findFirst({
      where: { branchId: before.branchId, code, NOT: { id } },
      select: { id: true },
    });
    if (clash) return { error: `The code ${code} is already used by another client.` };
  }

  // The name can be corrected here; two clients in one company can't share a name.
  const typedName = String(formData.get("name") ?? "").trim();
  const name = typedName || before.name;
  if (name !== before.name) {
    const taken = await prisma.client.findFirst({ where: { branchId: before.branchId, name: { equals: name, mode: "insensitive" }, NOT: { id } }, select: { id: true } });
    if (taken) return { error: `Another client is already called "${name}".` };
  }

  // Likely mistakes (a TRN that isn't a TRN, the same TRN or licence on another client, an expired licence) are shown for a
  // second look; the person can save anyway.
  if (formData.get("confirmWarnings") !== "1") {
    const next = { trn: stringOrNull(formData.get("trn")), tradeLicenseNumber: stringOrNull(formData.get("tradeLicenseNumber")), tradeLicenseExpiry: dateOrNull(formData.get("tradeLicenseExpiry")) };
    const warnings = [
      ...checkPartner(next, { trn: before.trn, tradeLicenseNumber: before.tradeLicenseNumber, tradeLicenseExpiry: before.tradeLicenseExpiry }),
      ...(await partnerDuplicates("client", { trn: next.trn !== before.trn ? next.trn : null, tradeLicenseNumber: next.tradeLicenseNumber !== before.tradeLicenseNumber ? next.tradeLicenseNumber : null, excludeId: id, branchId: before.branchId })),
    ];
    if (warnings.length > 0) return { error: null, warnings };
  }

  const data = {
    name,
    code,
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
    // Absence terms on this client's timesheets; only changed when the edit form sent them, so other callers can't reset them.
    ...(formData.get("absencePolicySent") === "1"
      ? {
          absentFreeDays: Math.min(31, Math.max(0, Math.trunc(numberOrNull(formData.get("absentFreeDays")) ?? 2))),
          absentDeductionPerDay: Math.max(0, numberOrNull(formData.get("absentDeductionPerDay")) ?? 25),
        }
      : {}),
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

  try {
    await prisma.client.update({ where: { id }, data });
  } catch (e) {
    if (isUniqueClash(e)) return { error: uniqueClashMessage(e) };
    throw e;
  }

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
  return { error: null };
}

export async function addClientContactAction(formData: FormData) {
  await requireWrite("partners.clients");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!clientId || !name) return;
  if (!(await assertClientInBranch(clientId, branchId, isSuperAdmin))) return;

  const created = await prisma.clientContact.create({
    data: {
      clientId,
      name,
      designation: stringOrNull(formData.get("designation")),
      phone: stringOrNull(formData.get("phone")),
      email: stringOrNull(formData.get("email")),
    },
  });
  await logChildChange({ parentType: "CLIENT", parentId: clientId, field: "contact", from: null, to: describeContact(created), user, branchId });

  revalidatePath(`/clients/${clientId}`);
}

export async function updateClientContactAction(formData: FormData) {
  await requireWrite("partners.clients");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  const contactId = String(formData.get("contactId") || "");
  const name = String(formData.get("name") || "").trim();
  if (!contactId || !name) return;
  if (!(await assertClientInBranch(clientId, branchId, isSuperAdmin))) return;

  const old = await prisma.clientContact.findUnique({ where: { id: contactId } });
  const updated = await prisma.clientContact.update({
    where: { id: contactId },
    data: {
      name,
      designation: stringOrNull(formData.get("designation")),
      phone: stringOrNull(formData.get("phone")),
      email: stringOrNull(formData.get("email")),
    },
  });
  await logChildChange({ parentType: "CLIENT", parentId: clientId, field: "contact", from: old ? describeContact(old) : null, to: describeContact(updated), user, branchId });

  revalidatePath(`/clients/${clientId}`);
}

export async function removeClientContactAction(formData: FormData) {
  await requirePermission("partners.clients", "delete");
  await requireWrite("partners.clients");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  const contactId = String(formData.get("contactId") || "");
  if (!contactId) return;
  if (!(await assertClientInBranch(clientId, branchId, isSuperAdmin))) return;
  const old = await prisma.clientContact.findUnique({ where: { id: contactId } });
  await prisma.clientContact.delete({ where: { id: contactId } });
  if (old) await logChildChange({ parentType: "CLIENT", parentId: clientId, field: "contact", from: describeContact(old), to: null, user, branchId });
  revalidatePath(`/clients/${clientId}`);
}

export async function addClientTradeRateAction(formData: FormData) {
  await requireWrite("partners.clients");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
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
  await logChildChange({ parentType: "CLIENT", parentId: clientId, field: `rate_${trade}`, from: existing ? Number(existing.rate) : null, to: rate, user, branchId });

  revalidatePath(`/clients/${clientId}`);
}

export async function removeClientTradeRateAction(formData: FormData) {
  await requirePermission("partners.clients", "delete");
  await requireWrite("partners.clients");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  const rateId = String(formData.get("rateId") || "");
  if (!rateId) return;
  if (!(await assertClientInBranch(clientId, branchId, isSuperAdmin))) return;
  const old = await prisma.clientTradeRate.findUnique({ where: { id: rateId }, select: { trade: true, rate: true } });
  await prisma.clientTradeRate.delete({ where: { id: rateId } });
  if (old) await logChildChange({ parentType: "CLIENT", parentId: clientId, field: `rate_${old.trade}`, from: Number(old.rate), to: null, user, branchId });
  revalidatePath(`/clients/${clientId}`);
}

export async function addClientDocumentAction(formData: FormData): Promise<{ error?: string }> {
  await requireWrite("partners.clients");
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const clientId = String(formData.get("clientId") || "");
  const type = String(formData.get("type") || "OTHER");
  const expiryDate = dateOrNull(formData.get("expiryDate"));
  // "Other" documents are named by the person (or read from the file); the file's extension is kept so it still opens.
  const typedName = String(formData.get("name") || "");
  const file = formData.get("file");
  if (!clientId || !(file instanceof File) || file.size === 0) return { error: "Choose a file first." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: `"${file.name}" is too large.` };
  if (!(await assertClientInBranch(clientId, branchId, isSuperAdmin))) return { error: "That client isn't in this company." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const created = await prisma.clientDocument.create({
    data: {
      clientId,
      type,
      filename: type === "OTHER" ? otherDocFilename(typedName, file.name) : file.name,
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
  return {};
}

export async function deleteClientDocumentAction(formData: FormData) {
  await requireWrite("partners.clients");
  assertContactsValid(formData);
  await requirePermission("partners.clients", "delete");
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
  await requireWrite("partners.clients");
  const { user, branchId } = await requireUserWithBranch();
  const results: { row: number; status: "created" | "updated" | "error"; message?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = (r["Company name"] || "").trim();
    if (!name) {
      results.push({ row: i + 2, status: "error", message: "Company name is required." });
      continue;
    }
    if (!branchId) {
      results.push({ row: i + 2, status: "error", message: "No company selected to import into." });
      continue;
    }
    try {
      // Looked up within this branch only: matching another company's client
      // would update it, and refusing with "belongs to a different branch" would
      // tell you a client of that name exists elsewhere.
      const existing = await findClientByName(name, branchId);
      const data = {
        contactPerson: stringOrNull(r["Contact person"] ?? null),
        contactEmail: stringOrNull(r["Contact email"] ?? null),
        contactPhone: stringOrNull(r["Contact phone"] ?? null),
        trn: stringOrNull(r["TRN"] ?? null),
        tradeLicenseNumber: stringOrNull(r["Trade license number"] ?? null),
      };
      if (existing) {
        const before = existing as unknown as Record<string, unknown>;
        // A blank cell means "not in this file", not "clear it".
        const changes = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== null));
        await prisma.client.update({ where: { id: existing.id }, data: changes });
        await logAudit({
          entityType: "CLIENT",
          entityId: existing.id,
          action: "UPDATE",
          before,
          after: changes,
          userId: user.id,
          userName: user.name,
          branchId,
        });
        results.push({ row: i + 2, status: "updated" });
      } else {
        const created = await prisma.client.create({
          data: { name, code: await uniqueClientCode(name, branchId), branchId, ...data },
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
  await requireWrite("partners.clients");
  assertContactsValid(formData);
  await requirePermission("partners.clients", "delete");
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
        `Can't delete: still linked to ${parts.join(" and ")}. Remove those first.`
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
  await requireWrite("partners.clients");
  await requirePermission("partners.clients", "delete");
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

/** The code the "Auto" button fills in: the name's initials, made unique in the branch. */
export async function suggestClientCodeAction(name: string, clientId?: string): Promise<string> {
  await requireView("partners.clients");
  const { branchId } = await requireUserWithBranch();
  if (!branchId) return "";
  return uniqueClientCode(name.trim(), branchId, clientId);
}
