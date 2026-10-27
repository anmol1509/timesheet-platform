"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, subjectOf } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { canMyCompanies, canViewSensitive } from "@/lib/permissions";
import { findSupplierByName, uniqueSupplierCode } from "@/lib/entityCode";
import { normalizeCode } from "@/lib/partyCode";
import { logAudit } from "@/lib/audit";
import { deleteImage, storeImage } from "@/lib/storedImage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL } from "@/lib/constants";
import { PARTY_ROLES, resolveDocTypes } from "@/lib/documentTypes";
import { OWNER_ROLE, isValidShare, ownershipProblem, ownershipSummary } from "@/lib/ownership";
import { contactsError } from "@/lib/validators";

const str = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;
const date = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};
const ROLES = new Set<string>(PARTY_ROLES.map((r) => r.value));

/** A person the form is adding, keyed so the links in the same request can refer to them. */
type PersonIn = { key: string; name: string; nationality?: string; phone?: string; email?: string };
/** What a person is to the company: an existing person (partyId) or one just described (personKey). Owners carry a share. */
type LinkIn = { role: string; partyId?: string; personKey?: string; percent?: number };
export type CreateCompanyResult = { error: string | null; id?: string; /** New people's ids, by the key the form gave them. */ personIds?: Record<string, string> };

/**
 * Adds one of your own companies from the Add company page: its details, logo, and owners/sponsors. The documents follow
 * one at a time through attachCompanyFileAction, so a few passport scans can't push the whole save over the size limit.
 * The company is an ordinary supplier row marked as an own company, so payroll, letters and the rest see it as before.
 */
export async function createOwnCompanyWizardAction(formData: FormData): Promise<CreateCompanyResult> {
  let logoId: string | null = null;
  try {
    const { user, branchId } = await requireUserWithBranch();
    if (!canMyCompanies(subjectOf(user), "create")) return { error: "You don't have permission to add a company." };
    if (!branchId) return { error: "Pick a specific branch from the switcher before adding a company." };
    const bad = contactsError(formData);
    if (bad) return { error: bad };

    const name = str(formData.get("name"));
    if (!name) return { error: "Enter the company name." };
    if (await findSupplierByName(name, branchId)) return { error: "A company or supplier with that name already exists." };
    const typed = normalizeCode(String(formData.get("code") || ""));
    if (typed && (await prisma.supplier.findFirst({ where: { branchId, code: typed }, select: { id: true } }))) return { error: `The code ${typed} is already used.` };
    const trnRaw = str(formData.get("trn"));
    if (trnRaw && !/^\d{15}$/.test(trnRaw.replace(/\s|-/g, ""))) return { error: "A TRN is 15 digits." };

    // A subsidiary hangs under one of your own primary companies in this branch.
    const parentId = str(formData.get("parentSupplierId"));
    if (parentId) {
      const parent = await prisma.supplier.findUnique({ where: { id: parentId }, select: { isOwnCompany: true, branchId: true, parentSupplierId: true } });
      if (!parent || !parent.isOwnCompany || parent.branchId !== branchId || parent.parentSupplierId) return { error: "Pick one of your own primary companies as the parent." };
    }

    let people: PersonIn[] = [];
    let links: LinkIn[] = [];
    try {
      const rawPeople = JSON.parse(String(formData.get("people") || "[]"));
      const rawLinks = JSON.parse(String(formData.get("links") || "[]"));
      if (Array.isArray(rawPeople)) people = rawPeople.slice(0, 20);
      if (Array.isArray(rawLinks)) links = rawLinks.slice(0, 30);
    } catch {
      return { error: "The owners and sponsors couldn't be read. Try again." };
    }
    const keys = new Set(people.map((p) => p?.key));
    if (people.some((p) => !p || typeof p.key !== "string" || typeof p.name !== "string" || !p.name.trim())) return { error: "Enter a name for each new person." };
    if (keys.size !== people.length) return { error: "The owners and sponsors couldn't be read. Try again." };
    for (const l of links) {
      if (!l || !ROLES.has(l.role)) return { error: "Choose a role for each owner or sponsor." };
      if (!!l.partyId === !!l.personKey) return { error: "Choose a person for each owner or sponsor." };
      if (l.personKey && !keys.has(l.personKey)) return { error: "Choose a person for each owner or sponsor." };
    }
    const subjects = links.map((l) => `${l.partyId ?? `new:${l.personKey}`}|${l.role}`);
    if (new Set(subjects).size !== subjects.length) return { error: "The same person is listed twice in the same role." };
    // Owners hold the shares; they must add up to exactly 100.
    const owners = links.filter((l) => l.role === OWNER_ROLE);
    if (owners.some((l) => !isValidShare(l.percent))) return { error: "Choose a share from 1% to 100% for each owner." };
    const ownerProblem = ownershipProblem(ownershipSummary(owners.map((l) => l.percent)));
    if (ownerProblem) return { error: ownerProblem };
    const existingIds = [...new Set(links.flatMap((l) => (l.partyId ? [l.partyId] : [])))];
    if (existingIds.length) {
      const found = await prisma.supplierParty.count({ where: { id: { in: existingIds }, branchId } });
      if (found !== existingIds.length) return { error: "One of the people you chose wasn't found." };
    }

    const logo = formData.get("logo");
    if (logo instanceof File && logo.size > 0) {
      const saved = await storeImage(logo);
      if ("error" in saved) return { error: `Logo: ${saved.error}` };
      logoId = saved.id;
    }

    const code = typed || (await uniqueSupplierCode(name, branchId));
    const created = await prisma.$transaction(async (tx) => {
      const company = await tx.supplier.create({
        data: {
          name, code, branchId, isOwnCompany: true, status: "ACTIVE", logoId,
          parentSupplierId: parentId,
          fullName: str(formData.get("fullName")),
          trn: trnRaw ? trnRaw.replace(/\s|-/g, "") : null,
          activeFrom: date(formData.get("activeFrom")),
          mohrePermitNumber: str(formData.get("mohrePermitNumber")),
          tradeLicenseNumber: str(formData.get("tradeLicenseNumber")),
          tradeLicenseExpiry: date(formData.get("tradeLicenseExpiry")),
          country: str(formData.get("country")),
          emirate: str(formData.get("emirate")),
          location: str(formData.get("location")),
          poBox: str(formData.get("poBox")),
          phone: str(formData.get("phone")),
          contactPerson: str(formData.get("contactPerson")),
          contactPhone: str(formData.get("contactPhone")),
          contactEmail: str(formData.get("contactEmail")),
        },
      });
      const personIds: Record<string, string> = {};
      for (const p of people) {
        const row = await tx.supplierParty.create({
          data: { branchId, name: p.name.trim().slice(0, 120), nationality: str(p.nationality ?? null)?.slice(0, 60) ?? null, phone: str(p.phone ?? null)?.slice(0, 40) ?? null, email: str(p.email ?? null)?.slice(0, 120) ?? null },
        });
        personIds[p.key] = row.id;
      }
      for (const l of links) {
        await tx.supplierPartyLink.create({
          data: { supplierId: company.id, partyId: l.partyId ?? personIds[l.personKey!], role: l.role, ownershipPercent: l.role === OWNER_ROLE ? l.percent! : null, branchId },
        });
      }
      return { company, personIds };
    });

    await logAudit({ entityType: "SUPPLIER", entityId: created.company.id, action: "CREATE", after: { name, code, isOwnCompany: true, owners: owners.length, people: links.length }, userId: user.id, userName: user.name, branchId });
    revalidatePath("/my-companies");
    revalidatePath("/suppliers");
    return { error: null, id: created.company.id, personIds: created.personIds };
  } catch (e) {
    await deleteImage(logoId);
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    console.error("[create-own-company] failed:", e instanceof Error ? e.message : e);
    if (e instanceof Error && /Unique constraint/i.test(e.message)) return { error: "A company or supplier with that name or code already exists." };
    return { error: "The company couldn't be saved. Check the details and try again." };
  }
}

/** How long after adding a company its creator may attach the documents chosen in the wizard. */
const ATTACH_WINDOW_MS = 3 * 60 * 60 * 1000;

/**
 * Files one document chosen in the Add company page, after the company exists. Only the person who just added the
 * company may do this, and only for a short while; later documents go through the company's own page.
 */
export async function attachCompanyFileAction(formData: FormData): Promise<{ error: string | null }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const subject = subjectOf(user);
  if (!canMyCompanies(subject, "create")) return { error: "You don't have permission to add a company's documents." };

  const companyId = String(formData.get("companyId") || "");
  const partyId = str(formData.get("partyId"));
  const docType = String(formData.get("docType") || "");
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file to add." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)}MB: the limit is ${MAX_UPLOAD_LABEL}.` };

  const company = await prisma.supplier.findUnique({ where: { id: companyId }, select: { id: true, branchId: true, isOwnCompany: true, createdAt: true } });
  if (!company || !company.isOwnCompany || isOutsideBranch(company.branchId, branchId, isSuperAdmin)) return { error: "That company wasn't found." };
  if (Date.now() - company.createdAt.getTime() > ATTACH_WINDOW_MS) return { error: "This company was added a while ago. Add the document from its page instead." };
  const made = await prisma.auditLog.findFirst({ where: { entityType: "SUPPLIER", entityId: company.id, action: "CREATE", userId: user.id }, select: { id: true } });
  if (!made) return { error: "Only the person who added this company can add its documents here." };

  if (partyId) {
    if (!canViewSensitive(subject)) return { error: "Adding owner and sponsor documents needs the Sensitive documents permission." };
    const party = await prisma.supplierPartyLink.findFirst({ where: { partyId, supplierId: company.id }, select: { id: true } });
    if (!party) return { error: "That owner or sponsor wasn't found." };
  }

  const entityType = partyId ? "SUPPLIER_PARTY" : "SUPPLIER";
  const rows = company.branchId ? await prisma.documentType.findMany({ where: { branchId: company.branchId } }) : [];
  const type = resolveDocTypes(rows, entityType).find((t) => t.key === docType);
  if (!type || !type.isActive) return { error: `“${docType}” isn't a document type this branch uses.` };

  await prisma.attachment.create({
    data: {
      entityType, entityId: partyId ?? company.id, docType, filename: file.name.slice(0, 200), fileData: Buffer.from(await file.arrayBuffer()),
      mimeType: file.type || "application/octet-stream", expiryDate: type.hasExpiry ? date(formData.get("expiry")) : null, branchId: company.branchId, uploadedById: user.id,
    },
  });
  return { error: null };
}
