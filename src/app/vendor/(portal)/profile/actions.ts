"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getVendor } from "@/lib/vendor/session";
import { approverIds, notifyUsers } from "@/lib/notifications/notify";
import { normalizePhone } from "@/lib/phone";
import { parseDay } from "@/lib/dates";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { changedFields, FIELDS_FOR, isValidIban, sanitizePayload, SUPPLIER_DOC_TYPES, type ChangeKind } from "@/lib/supplierRequests";
import { assertContactsValid } from "@/lib/validators";

type State = { error: string | null; ok?: boolean };
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
const ALLOWED = ["application/pdf", "image/jpeg", "image/png"];

/** Ask to change bank or contact details. Nothing changes until our staff approve it. */
export async function requestChangeAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const vendor = await getVendor();
  if (!vendor) return { error: "Please sign in again." };
  const kind = str(formData.get("kind")) as ChangeKind;
  if (kind !== "BANK" && kind !== "CONTACT") return { error: "Unknown request." };

  const raw: Record<string, string> = {};
  for (const f of FIELDS_FOR[kind]) raw[f] = str(formData.get(f));
  const requested = sanitizePayload(kind, raw);

  const current = await prisma.supplier.findUnique({ where: { id: vendor.id } });
  if (!current) return { error: "Please sign in again." };
  const changes = changedFields(current as unknown as Record<string, string | null>, requested);
  if (Object.keys(changes).length === 0) return { error: "Nothing has changed from what we already have." };

  if (changes.iban && !isValidIban(changes.iban)) return { error: "That IBAN doesn't look right. Check it and try again (UAE IBANs are 23 characters, starting AE)." };
  if (changes.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.contactEmail)) return { error: "Enter a valid email address." };
  if (changes.contactPhone) {
    const phone = normalizePhone(changes.contactPhone);
    if (!phone) return { error: "Enter the mobile number with its country code, e.g. +971 50 123 4567." };
    changes.contactPhone = phone;
    // The contact number is also the portal sign-in number, so it must belong to one supplier only.
    const others = await prisma.supplier.findMany({ where: { id: { not: vendor.id }, portalEnabled: true }, select: { contactPhone: true, phone: true, coordinatorPhone: true } });
    if (others.some((o) => [o.contactPhone, o.phone, o.coordinatorPhone].some((n) => normalizePhone(n) === phone))) {
      return { error: "That number is already used by another company on the portal. Use a different number, or contact us." };
    }
  }

  if (await prisma.supplierChangeRequest.count({ where: { supplierId: vendor.id, kind, status: "PENDING" } }) > 0) {
    return { error: "You already have a change waiting for approval. Cancel it first if you want to send a different one." };
  }
  await prisma.supplierChangeRequest.create({ data: { supplierId: vendor.id, branchId: vendor.branchId, kind, payload: changes } });
  await notifyUsers({
    userIds: await approverIds("partners", vendor.branchId),
    kind: "SUPPLIER_CHANGE_REQUEST",
    title: `${kind === "BANK" ? "Bank" : "Contact"} details change to approve`,
    body: `${vendor.name} asked to change ${Object.keys(changes).length} field${Object.keys(changes).length === 1 ? "" : "s"}.${kind === "BANK" ? " Check it before approving: it decides where payments go." : ""}`,
    href: "/approvals?type=CHANGE",
  });
  revalidatePath("/vendor/profile");
  return { error: null, ok: true };
}

export async function cancelChangeAction(formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const vendor = await getVendor();
  if (!vendor) return { error: "Please sign in again." };
  await prisma.supplierChangeRequest.deleteMany({ where: { id: str(formData.get("id")), supplierId: vendor.id, status: "PENDING" } });
  revalidatePath("/vendor/profile");
  return { error: null, ok: true };
}

/** Add a company document (licence, insurance, permit…) to the supplier's record. */
export async function uploadDocumentAction(_prev: State, formData: FormData): Promise<State> {
  assertContactsValid(formData);
  const vendor = await getVendor();
  if (!vendor) return { error: "Please sign in again." };
  const docType = str(formData.get("docType"));
  if (!SUPPLIER_DOC_TYPES.some((t) => t.value === docType)) return { error: "Choose what kind of document this is." };
  const f = formData.get("file");
  if (!(f instanceof File) || f.size === 0) return { error: "Choose a file to upload." };
  if (!ALLOWED.includes(f.type)) return { error: "Upload a PDF, JPG or PNG." };
  if (f.size > MAX_UPLOAD_BYTES) return { error: `That file is ${(f.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_UPLOAD_LABEL}.` };
  const expiryRaw = str(formData.get("expiryDate"));
  const expiryDate = expiryRaw ? parseDay(expiryRaw) : null;
  if (expiryRaw && !expiryDate) return { error: "Enter a valid expiry date." };

  await prisma.attachment.create({
    data: { entityType: "SUPPLIER", entityId: vendor.id, docType, filename: f.name, fileData: Buffer.from(await f.arrayBuffer()), mimeType: f.type, expiryDate, branchId: vendor.branchId, uploadedBySupplierId: vendor.id },
  });
  revalidatePath("/vendor/profile");
  return { error: null, ok: true };
}
