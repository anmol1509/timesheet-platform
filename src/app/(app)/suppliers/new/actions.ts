"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requireWrite } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { findSupplierByName, uniqueSupplierCode } from "@/lib/entityCode";
import { normalizeCode } from "@/lib/partyCode";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { assertContactsValid } from "@/lib/validators";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const date = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

const DOC_TYPES = new Set(["TRADE_LICENSE", "MOHRE_PERMIT", "ESTABLISHMENT_CARD", "TRN_CERTIFICATE", "WORKMEN_COMPENSATION_INSURANCE", "EJARI_TENANCY", "CHAMBER_OF_COMMERCE", "OTHER"]);

/** Registers a supplier from the wizard: the reviewed details plus the documents it was read from. */
export async function createSupplierWizardAction(formData: FormData): Promise<{ error: string | null; id?: string }> {
  await requireWrite("partners.suppliers");
  assertContactsValid(formData);
  const { user, branchId } = await requireUserWithBranch();
  if (!branchId) return { error: "Pick a specific branch from the switcher before adding a supplier." };

  const name = str(formData.get("name"));
  if (!name) return { error: "Enter the supplier name." };
  if (await findSupplierByName(name, branchId)) return { error: "A supplier with that name already exists." };
  const typed = normalizeCode(String(formData.get("code") || ""));
  if (typed && (await prisma.supplier.findFirst({ where: { branchId, code: typed }, select: { id: true } }))) {
    return { error: `The code ${typed} is already used by another supplier.` };
  }
  const trn = str(formData.get("trn"));
  if (trn && !/^\d{15}$/.test(trn.replace(/\s|-/g, ""))) return { error: "A TRN is 15 digits." };

  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  const docTypes = formData.getAll("docTypes").map(String);
  const expiries = formData.getAll("docExpiries").map(String);
  for (const f of files) {
    if (f.size > MAX_UPLOAD_BYTES) return { error: `${f.name} is ${(f.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_UPLOAD_LABEL}.` };
  }

  const code = typed || (await uniqueSupplierCode(name, branchId));
  const created = await prisma.supplier.create({
    data: {
      name, code, branchId,
      fullName: str(formData.get("fullName")),
      category: str(formData.get("category")),
      status: "ACTIVE",
      trn: trn ? trn.replace(/\s|-/g, "") : null,
      activeFrom: date(formData.get("activeFrom")),
      mohrePermitNumber: str(formData.get("mohrePermitNumber")),
      tradeLicenseNumber: str(formData.get("tradeLicenseNumber")),
      tradeLicenseExpiry: date(formData.get("tradeLicenseExpiry")),
      country: str(formData.get("country")),
      emirate: str(formData.get("emirate")),
      contactPerson: str(formData.get("contactPerson")),
      contactPhone: str(formData.get("contactPhone")),
      contactEmail: str(formData.get("contactEmail")),
    },
  });

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const docType = DOC_TYPES.has(docTypes[i]) ? docTypes[i] : "OTHER";
    await prisma.attachment.create({
      data: {
        entityType: "SUPPLIER", entityId: created.id, docType, filename: f.name, fileData: Buffer.from(await f.arrayBuffer()),
        mimeType: f.type || "application/octet-stream", expiryDate: date(expiries[i] ?? null), branchId, uploadedById: user.id,
      },
    });
  }

  await logAudit({ entityType: "SUPPLIER", entityId: created.id, action: "CREATE", after: { name, code, documents: files.length }, userId: user.id, userName: user.name, branchId });
  revalidatePath("/suppliers");
  return { error: null, id: created.id };
}
