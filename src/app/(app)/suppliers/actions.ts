"use server";

import { uniqueSupplierCode } from "@/lib/entityCode";
import { nameKey as supplierNameKey, normalizeCode, pickCode } from "@/lib/partyCode";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch, requirePermission } from "@/lib/auth";
import { branchWhere, isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { matchTrade } from "@/lib/trades";
import { assertContactsValid } from "@/lib/validators";

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
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const fullName = String(formData.get("fullName") || "").trim() || null;

  if (!branchId) {
    redirect(
      `/suppliers?error=${encodeURIComponent(
        isSuperAdmin
          ? "Pick a branch from the switcher before adding a supplier."
          : "Your account has no branch assigned — contact an admin."
      )}`
    );
  }

  const existing = await prisma.supplier.findFirst({ where: { name, branchId }, select: { id: true } });
  if (existing) {
    redirect(
      `/suppliers?error=${encodeURIComponent("A supplier with that name already exists.")}`
    );
  }

  // A code typed into the form wins; blank means "generate it from the name".
  const typed = normalizeCode(String(formData.get("code") || ""));
  if (typed && (await prisma.supplier.findFirst({ where: { branchId, code: typed }, select: { id: true } }))) {
    redirect(`/suppliers?error=${encodeURIComponent(`The code ${typed} is already used by another supplier.`)}`);
  }
  const code = typed || (await uniqueSupplierCode(name, branchId));
  const created = await prisma.supplier.create({ data: { name, code, fullName, branchId } });

  await logAudit({
    entityType: "SUPPLIER",
    entityId: created.id,
    action: "CREATE",
    after: { name, code, fullName },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/suppliers");
}

// Adds a subsidiary directly under a given parent — used by the chrome-tab
// "+" control on the supplier detail page, so parentSupplierId is always
// supplied by the caller (the tab strip's root) rather than picked by hand.
// Returns a result object (instead of redirecting) so the client popover can
// show pending/error state inline rather than relying on a full navigation
// to surface problems.
//
// The subsidiary always inherits the parent's own branchId — not the
// caller's currently-active branch — so it never ends up in a different
// branch than the company it belongs to (which previously made the Parent
// Supplier dropdown unable to resolve a matching option and show a name).
// This also means a Super Admin doesn't need a specific branch selected in
// the switcher to add a subsidiary: `isOutsideBranch` already allows Super
// Admins through regardless, so the only real requirement is read access to
// the parent record.
export async function createSubsidiaryAction(
  formData: FormData
): Promise<{ error: string } | { id: string }> {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const parentSupplierId = String(formData.get("parentSupplierId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!parentSupplierId || !name) {
    return { error: "Enter a subsidiary name." };
  }

  const parent = await prisma.supplier.findUnique({ where: { id: parentSupplierId } });
  if (!parent || isOutsideBranch(parent.branchId, branchId, isSuperAdmin)) {
    return { error: "Parent supplier not found." };
  }

  const existing = await prisma.supplier.findFirst({ where: { name, branchId: parent.branchId }, select: { id: true } });
  if (existing) {
    return { error: "A supplier with that name already exists." };
  }

  const code = await uniqueSupplierCode(name, parent.branchId!);
  const created = await prisma.supplier.create({
    data: { name, code, parentSupplierId, branchId: parent.branchId },
  });

  await logAudit({
    entityType: "SUPPLIER",
    entityId: created.id,
    action: "CREATE",
    after: { name, code, parentSupplierId },
    userId: user.id,
    userName: user.name,
    branchId: parent.branchId,
  });

  revalidatePath(`/suppliers/${parentSupplierId}`);
  revalidatePath("/suppliers");
  return { id: created.id };
}

// Company & Compliance tab — every field this action writes lives in that
// tab's form, so a save here never touches Contact/Payment fields.
export async function updateSupplierCompanyAction(formData: FormData): Promise<{ error: string | null }> {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("supplierId") || "");
  if (!id) return { error: null };

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing || isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) return { error: null };

  // Blank keeps the current code (or makes one if the supplier never had one).
  const typedCode = normalizeCode(String(formData.get("code") || ""));
  const code = typedCode || existing.code || (await uniqueSupplierCode(existing.name, existing.branchId!));
  if (code !== existing.code) {
    const clash = await prisma.supplier.findFirst({
      where: { branchId: existing.branchId, code, NOT: { id } },
      select: { id: true },
    });
    if (clash) return { error: `The code ${code} is already used by another supplier.` };
  }

  const data = {
    code,
    fullName: stringOrNull(formData.get("fullName")),
    status: String(formData.get("status") || "ACTIVE"),
    trn: stringOrNull(formData.get("trn")),
    activeFrom: dateOrNull(formData.get("activeFrom")),
    mohrePermitNumber: stringOrNull(formData.get("mohrePermitNumber")),
    tradeLicenseNumber: stringOrNull(formData.get("tradeLicenseNumber")),
    tradeLicenseExpiry: dateOrNull(formData.get("tradeLicenseExpiry")),
    category: stringOrNull(formData.get("category")),
    previousId: stringOrNull(formData.get("previousId")),
    country: stringOrNull(formData.get("country")),
    emirate: stringOrNull(formData.get("emirate")),
    pointOfContact: stringOrNull(formData.get("pointOfContact")),
    supplierAmountLimit: numberOrNull(formData.get("supplierAmountLimit")),
    account: stringOrNull(formData.get("account")),
    isOwnCompany: formData.get("isOwnCompany") === "on",
    // Pay settings only mean something for our own companies; clear them otherwise.
    payType: formData.get("isOwnCompany") === "on" && ["BASIC", "HOURLY"].includes(String(formData.get("payType") || "")) ? String(formData.get("payType")) : null,
    wpsEstablishmentId: formData.get("isOwnCompany") === "on" ? stringOrNull(formData.get("wpsEstablishmentId")) : null,
    allowManualLabourId: formData.get("allowManualLabourId") === "on",
    overtime: formData.get("overtime") === "on",
  };

  await prisma.supplier.update({ where: { id }, data });

  await logAudit({
    entityType: "SUPPLIER",
    entityId: id,
    action: "UPDATE",
    before: existing as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/suppliers/${id}`);
  revalidatePath("/suppliers");
  return { error: null };
}

/** Move a supplier under a primary supplier, or (parentId null) make it a
 * primary supplier itself. The hierarchy is two levels, so a supplier that has
 * subsidiaries can't become one, and the parent must be a primary supplier in
 * the same branch. The forms confirm before calling this. */
export async function setSupplierParentAction(
  supplierId: string,
  parentId: string | null,
): Promise<{ error: string | null }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const s = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: { _count: { select: { subsidiaries: true } } },
  });
  if (!s || isOutsideBranch(s.branchId, branchId, isSuperAdmin)) return { error: "Supplier not found." };
  if (parentId === s.parentSupplierId) return { error: null };

  if (parentId) {
    if (parentId === s.id) return { error: "A supplier can't be its own parent." };
    if (s._count.subsidiaries > 0) {
      return {
        error: `${s.name} has subsidiaries of its own. Make them primary suppliers or move them first.`,
      };
    }
    const parent = await prisma.supplier.findUnique({ where: { id: parentId } });
    if (!parent || parent.branchId !== s.branchId || isOutsideBranch(parent.branchId, branchId, isSuperAdmin)) {
      return { error: "Primary supplier not found." };
    }
    if (parent.parentSupplierId) return { error: `${parent.name} is itself a subsidiary. Pick a primary supplier.` };
  }

  await prisma.supplier.update({ where: { id: supplierId }, data: { parentSupplierId: parentId } });
  await logAudit({
    entityType: "SUPPLIER",
    entityId: supplierId,
    action: "UPDATE",
    before: { parentSupplierId: s.parentSupplierId },
    after: { parentSupplierId: parentId },
    userId: user.id,
    userName: user.name,
    branchId: s.branchId,
  });

  revalidatePath(`/suppliers/${supplierId}`);
  if (s.parentSupplierId) revalidatePath(`/suppliers/${s.parentSupplierId}`);
  if (parentId) revalidatePath(`/suppliers/${parentId}`);
  revalidatePath("/suppliers");
  return { error: null };
}

/** The code the "Auto" button fills in: the name's acronym, made unique in the branch. */
export async function suggestSupplierCodeAction(name: string, supplierId?: string): Promise<string> {
  const { branchId } = await requireUserWithBranch();
  if (!branchId) return "";
  return uniqueSupplierCode(name.trim(), branchId, supplierId);
}

// Contact & Payment tab — every field this action writes lives in that
// tab's form, so a save here never touches Company/Compliance fields.
export async function updateSupplierContactPaymentAction(formData: FormData) {
  assertContactsValid(formData);
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("supplierId") || "");
  if (!id) return;

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing || isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) return;

  const data = {
    contactPerson: stringOrNull(formData.get("contactPerson")),
    contactPhone: stringOrNull(formData.get("contactPhone")),
    contactEmail: stringOrNull(formData.get("contactEmail")),
    phone: stringOrNull(formData.get("phone")),
    location: stringOrNull(formData.get("location")),
    poBox: stringOrNull(formData.get("poBox")),
    coordinatorName: stringOrNull(formData.get("coordinatorName")),
    coordinatorPhone: stringOrNull(formData.get("coordinatorPhone")),
    coordinatorEmail: stringOrNull(formData.get("coordinatorEmail")),
    bankName: stringOrNull(formData.get("bankName")),
    iban: stringOrNull(formData.get("iban")),
    bankAccountName: stringOrNull(formData.get("bankAccountName")),
    bankAccountNumber: stringOrNull(formData.get("bankAccountNumber")),
    bankCompany: stringOrNull(formData.get("bankCompany")),
    bankEmirate: stringOrNull(formData.get("bankEmirate")),
    paymentTerms: stringOrNull(formData.get("paymentTerms")),
    payoutCycleStartDay: Math.min(
      31,
      Math.max(1, Number(formData.get("payoutCycleStartDay")) || 1)
    ),
  };

  await prisma.supplier.update({ where: { id }, data });

  await logAudit({
    entityType: "SUPPLIER",
    entityId: id,
    action: "UPDATE",
    before: existing as unknown as Record<string, unknown>,
    after: data,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/suppliers/${id}`);
  revalidatePath("/suppliers");
}

const APPROVAL_FIELDS = ["approvalStatus", "labourApprovalStatus", "invoiceApprovalStatus"] as const;
type ApprovalField = (typeof APPROVAL_FIELDS)[number];

export async function updateSupplierApprovalAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("partners", "approve");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("supplierId") || "");
  const field = String(formData.get("field") || "") as ApprovalField;
  const value = String(formData.get("value") || "");
  if (!id || !APPROVAL_FIELDS.includes(field) || !["Pending", "Approved", "Rejected"].includes(value)) return;

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing || isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) return;

  await prisma.supplier.update({ where: { id }, data: { [field]: value } });

  await logAudit({
    entityType: "SUPPLIER",
    entityId: id,
    action: "UPDATE",
    before: { [field]: existing[field] },
    after: { [field]: value },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/suppliers/${id}`);
}

type ImportResult = { row: number; status: "created" | "updated" | "skipped" | "error"; message?: string };

/** Import suppliers (and their parent companies) from spreadsheet rows.
 *
 * A supplier often appears on many rows — a sheet built from timesheet lines
 * repeats it once per line — so rows are first merged per supplier. A parent
 * named on a row that isn't a supplier yet is created as a primary supplier;
 * a supplier naming itself as parent means "primary"; one listed under several
 * parents goes under the one named most often, and the result says so. Names
 * match ignoring case, dots and spacing. Blank cells never clear saved values. */
export async function bulkImportSuppliersAction(rows: Record<string, string>[]): Promise<ImportResult[]> {
  const { user, branchId } = await requireUserWithBranch();
  const results: ImportResult[] = [];
  const cell = (r: Record<string, string>, k: string) => (r[k] ?? "").trim();
  if (!branchId) {
    return rows.map((_, i) => ({ row: i + 2, status: "error" as const, message: "No branch selected to import into." }));
  }

  type Group = {
    key: string;
    name: string;
    firstRow: number;
    fields: Record<string, string>;
    code: string;
    votes: Map<string, { name: string; n: number }>; // "" = primary
    parentKey: string;
    parentName: string;
    conflict: string | null;
  };
  const groups = new Map<string, Group>();
  const order: Group[] = [];
  const FIELDS: [string, string][] = [
    ["fullName", "Full name"],
    ["contactPerson", "Contact person"],
    ["contactPhone", "Contact phone"],
    ["contactEmail", "Contact email"],
    ["tradeLicenseNumber", "Trade license number"],
    ["category", "Category"],
    ["trn", "TRN"],
  ];

  rows.forEach((r, i) => {
    const row = i + 2;
    const name = cell(r, "Supplier name");
    if (!name) {
      results.push({ row, status: "error", message: "Supplier name is required." });
      return;
    }
    const key = supplierNameKey(name);
    let g = groups.get(key);
    if (g) {
      results.push({ row, status: "skipped", message: `Same supplier as row ${g.firstRow}; merged.` });
    } else {
      g = { key, name, firstRow: row, fields: {}, code: "", votes: new Map(), parentKey: "", parentName: "", conflict: null };
      groups.set(key, g);
      order.push(g);
    }
    for (const [field, col] of FIELDS) {
      const v = cell(r, col);
      if (v && !g.fields[field]) g.fields[field] = v;
    }
    if (!g.code) g.code = normalizeCode(cell(r, "Supplier code"));
    const parent = cell(r, "Parent supplier");
    if (parent) {
      const pk = supplierNameKey(parent);
      const vote = pk === key ? "" : pk; // naming itself = "this is a primary supplier"
      const cur = g.votes.get(vote);
      if (cur) cur.n++;
      else g.votes.set(vote, { name: vote === "" ? "" : parent, n: 1 });
    }
  });

  for (const g of order) {
    let best: [string, { name: string; n: number }] | null = null;
    for (const e of g.votes) if (!best || e[1].n > best[1].n || (e[1].n === best[1].n && e[0] === "")) best = e;
    if (best) {
      g.parentKey = best[0];
      g.parentName = best[1].name;
    }
    if (g.votes.size > 1) {
      const list = [...g.votes.values()].map((v) => `${v.name || "primary"} ×${v.n}`).join(", ");
      g.conflict = `Listed under several parents (${list}); ${g.parentKey ? `used ${g.parentName}` : "kept as a primary supplier"}.`;
    }
  }

  // The branch's suppliers, loaded once and kept current as rows are applied.
  const all = await prisma.supplier.findMany({ where: { branchId } });
  const byKey = new Map(all.map((x) => [supplierNameKey(x.name), x]));
  const codeOwner = new Map<string, string>();
  for (const x of all) if (x.code) codeOwner.set(x.code, x.id);
  const kids = new Map<string, number>();
  for (const x of all) if (x.parentSupplierId) kids.set(x.parentSupplierId, (kids.get(x.parentSupplierId) ?? 0) + 1);
  const taken = () => new Set<string | null>(codeOwner.keys());

  const audit = (entityId: string, action: "CREATE" | "UPDATE", before: Record<string, unknown> | undefined, after: Record<string, unknown>) =>
    logAudit({ entityType: "SUPPLIER", entityId, action, before, after, userId: user.id, userName: user.name, branchId });

  // Suppliers with no parent first, so every parent exists before its subsidiaries.
  const sorted = [...order].sort((x, y) => Number(!!x.parentKey) - Number(!!y.parentKey) || x.firstRow - y.firstRow);

  for (const g of sorted) {
    const row = g.firstRow;
    const notes: string[] = g.conflict ? [g.conflict] : [];
    const fail = (message: string) => results.push({ row, status: "error", message });
    try {
      const existing = byKey.get(g.key);
      const data: Record<string, string> = { ...g.fields };

      if (g.code && g.code !== existing?.code) {
        const owner = codeOwner.get(g.code);
        if (owner && owner !== existing?.id) {
          fail(`The code ${g.code} is already used by another supplier.`);
          continue;
        }
        data.code = g.code;
      }

      let parentId: string | undefined;
      if (g.parentKey) {
        const listedAs = groups.get(g.parentKey);
        if (listedAs?.parentKey) {
          fail(`"${g.parentName}" is itself listed as a subsidiary, and a parent must be a primary supplier.`);
          continue;
        }
        if (existing && (kids.get(existing.id) ?? 0) > 0) {
          fail(`"${existing.name}" has subsidiaries of its own, so it can't become one.`);
          continue;
        }
        let parent = byKey.get(g.parentKey);
        if (!parent) {
          const code = pickCode(g.parentName, taken());
          parent = await prisma.supplier.create({ data: { name: g.parentName, code, branchId } });
          byKey.set(g.parentKey, parent);
          codeOwner.set(code, parent.id);
          await audit(parent.id, "CREATE", undefined, { name: g.parentName, code, branchId });
          notes.push(`Created primary supplier "${g.parentName}" (it wasn't in the list).`);
        } else if (parent.parentSupplierId) {
          // A supplier that has no subsidiaries of its own is free to become a
          // parent: the file puts others under it, so it is made primary. (The
          // file listing it under yet another supplier was rejected above.)
          const was = all.find((x) => x.id === parent!.parentSupplierId)?.name ?? "another supplier";
          await prisma.supplier.update({ where: { id: parent.id }, data: { parentSupplierId: null } });
          kids.set(parent.parentSupplierId, (kids.get(parent.parentSupplierId) ?? 1) - 1);
          await audit(parent.id, "UPDATE", { parentSupplierId: parent.parentSupplierId }, { parentSupplierId: null });
          parent.parentSupplierId = null;
          notes.push(`"${parent.name}" was a subsidiary of ${was}; made a primary supplier because others are listed under it.`);
        }
        parentId = parent.id;
      }

      if (existing) {
        const update: Record<string, string> = { ...data };
        if (parentId && parentId !== existing.parentSupplierId) update.parentSupplierId = parentId;
        if (Object.keys(update).length > 0) {
          const before = { ...existing } as unknown as Record<string, unknown>;
          await prisma.supplier.update({ where: { id: existing.id }, data: update });
          if (update.parentSupplierId) {
            if (existing.parentSupplierId) kids.set(existing.parentSupplierId, (kids.get(existing.parentSupplierId) ?? 1) - 1);
            kids.set(parentId!, (kids.get(parentId!) ?? 0) + 1);
          }
          if (update.code) {
            if (existing.code) codeOwner.delete(existing.code);
            codeOwner.set(update.code, existing.id);
          }
          Object.assign(existing, update);
          await audit(existing.id, "UPDATE", before, update);
        }
        results.push({ row, status: "updated", message: notes.join(" ") || undefined });
      } else {
        const code = data.code ?? pickCode(g.name, taken());
        const create = { name: g.name, ...data, code, ...(parentId ? { parentSupplierId: parentId } : {}), branchId };
        const created = await prisma.supplier.create({ data: create });
        byKey.set(g.key, created);
        codeOwner.set(code, created.id);
        if (parentId) kids.set(parentId, (kids.get(parentId) ?? 0) + 1);
        await audit(created.id, "CREATE", undefined, create);
        results.push({ row, status: "created", message: notes.join(" ") || undefined });
      }
    } catch (e) {
      fail(e instanceof Error ? e.message : "Failed to import row.");
    }
  }

  results.sort((x, y) => x.row - y.row);
  revalidatePath("/suppliers");
  return results;
}

export async function deleteSupplierAction(formData: FormData) {
  assertContactsValid(formData);
  await requirePermission("partners", "delete");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("supplierId") || "");
  if (!id) return;

  const target = await prisma.supplier.findUnique({ where: { id } });
  if (!target || isOutsideBranch(target.branchId, branchId, isSuperAdmin)) return;

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

  await logAudit({
    entityType: "SUPPLIER",
    entityId: id,
    action: "DELETE",
    before: target as unknown as Record<string, unknown>,
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/suppliers");
  revalidatePath("/employees");
}

type InsuranceEmployeeRow = {
  employeeIdNo: string;
  name: string;
  category: string | null;
  designation: string | null;
  salary: string | null;
};

// Bulk-creates Employee records reviewed from a Workmen Compensation
// Insurance PDF extraction. Per-row-tolerant, matching
// bulkImportEmployeesAction's shape — one bad row doesn't abort the batch.
// Every field besides employeeIdNo/name/trade/position/salary is left null,
// which is exactly what makes the record show as "Incomplete."
export async function createEmployeesFromInsuranceAction(
  supplierId: string,
  rows: InsuranceEmployeeRow[]
): Promise<{ created: number; requested: number; errors: { row: number; message: string }[] }> {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const errors: { row: number; message: string }[] = [];
  if (!branchId) {
    return { created: 0, requested: rows.length, errors: [{ row: 0, message: "No branch selected to import into." }] };
  }

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { branchId: true } });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) {
    return { created: 0, requested: rows.length, errors: [{ row: 0, message: "Supplier not found." }] };
  }

  let created = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const employeeIdNo = r.employeeIdNo.trim();
    const name = r.name.trim();
    if (!employeeIdNo || !name) {
      errors.push({ row: i + 1, message: "Employee ID and name are required." });
      continue;
    }
    const existing = await prisma.employee.findUnique({ where: { employeeIdNo }, select: { id: true } });
    if (existing) {
      errors.push({ row: i + 1, message: `Employee ID ${employeeIdNo} already exists.` });
      continue;
    }

    const salary = r.salary ? Number(r.salary.replace(/[^0-9.]/g, "")) : null;
    // The insurer prints whatever designation they like. Only a trade from our
    // list is accepted; anything unrecognised or ambiguous ("Carpenter" fits
    // three of ours) is left blank to be set by hand, rather than inventing a
    // trade that nothing else in the app knows about.
    const trade = matchTrade(r.designation);
    const employee = await prisma.employee.create({
      data: {
        employeeIdNo,
        name,
        trade,
        position: trade,
        salaryType: salary != null && Number.isFinite(salary) ? "BASIC" : null,
        salaryRate: salary != null && Number.isFinite(salary) ? salary : null,
        supplierId,
        branchId,
      },
    });

    await logAudit({
      entityType: "EMPLOYEE",
      entityId: employee.id,
      action: "CREATE",
      after: {
        employeeIdNo,
        name,
        trade,
        // Kept so an unmatched designation can be traced back to the source.
        designationOnCertificate: r.designation,
        supplierId,
      },
      userId: user.id,
      userName: user.name,
      branchId,
    });

    created++;
  }

  revalidatePath("/employees");
  revalidatePath(`/suppliers/${supplierId}`);
  return { created, requested: rows.length, errors };
}

export type InsuredNameMatch = {
  /** The name exactly as printed on the certificate. */
  name: string;
  status: "new" | "exists_here" | "exists_elsewhere";
  matches: {
    id: string;
    employeeIdNo: string;
    name: string;
    supplierName: string | null;
    active: boolean;
  }[];
};

/** Lowercase, punctuation collapsed — for comparing names only. */
function normaliseName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Same words in any order, so "Amrit Kumar Shrestha" matches "Shrestha Amrit Kumar". */
function nameKey(value: string) {
  return normaliseName(value).split(" ").filter(Boolean).sort().join(" ");
}

/**
 * Checks scanned certificate names against the roster before anything is added.
 *
 * A workmen's-compensation certificate carries no employee ID — just names — so
 * re-uploading next year's renewal would otherwise re-add everybody. Matching
 * is on the name alone, which is all the document gives us: exact, or the same
 * words in a different order.
 *
 * A match is reported, never acted on. Names repeat in this workforce (three
 * records already share one name), so deciding whether two "Amrit Kumar
 * Shrestha"s are one person is a judgement for whoever is looking at the
 * certificate, not something to resolve silently.
 */
export async function matchInsuredNamesAction(
  supplierId: string,
  names: string[]
): Promise<InsuredNameMatch[]> {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { branchId: true },
  });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) {
    return names.map((name) => ({ name, status: "new" as const, matches: [] }));
  }

  const roster = await prisma.employee.findMany({
    where: branchWhere(branchId),
    select: {
      id: true,
      name: true,
      employeeIdNo: true,
      active: true,
      supplierId: true,
      supplier: { select: { name: true } },
    },
  });

  const byKey = new Map<string, typeof roster>();
  for (const e of roster) {
    const key = nameKey(e.name);
    byKey.set(key, [...(byKey.get(key) ?? []), e]);
  }

  return names.map((name) => {
    const found = byKey.get(nameKey(name)) ?? [];
    if (found.length === 0) return { name, status: "new" as const, matches: [] };

    // Under this supplier is a straight duplicate; under another is more likely
    // a transfer or a different person with the same name.
    const here = found.some((e) => e.supplierId === supplierId);
    return {
      name,
      status: here ? ("exists_here" as const) : ("exists_elsewhere" as const),
      matches: found.map((e) => ({
        id: e.id,
        employeeIdNo: e.employeeIdNo,
        name: e.name,
        supplierName: e.supplier?.name ?? null,
        active: e.active,
      })),
    };
  });
}

export type SupplierPanel = {
  employees: {
    id: string;
    employeeIdNo: string;
    name: string;
    trade: string | null;
    status: string;
    active: boolean;
  }[];
  certificates: {
    id: string;
    filename: string;
    expiryDate: string | null;
    uploadedAt: string;
  }[];
};

/**
 * Everything about a supplier's people in one place: who is on the books for
 * them, and the workmen's-compensation certificates covering those people.
 *
 * Certificates accumulate — a new one is issued every renewal — so they're a
 * list with expiry dates rather than a single current file. An expired
 * certificate is a live compliance problem, which is why the expiry travels
 * with the document rather than being remembered separately.
 */
export async function getSupplierPanelAction(supplierId: string): Promise<SupplierPanel> {
  const { branchId, isSuperAdmin } = await requireUserWithBranch();

  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    select: { branchId: true },
  });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) {
    return { employees: [], certificates: [] };
  }

  const [employees, certificates] = await Promise.all([
    prisma.employee.findMany({
      where: { supplierId },
      select: {
        id: true,
        employeeIdNo: true,
        name: true,
        trade: true,
        status: true,
        active: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.attachment.findMany({
      where: {
        entityType: "SUPPLIER",
        entityId: supplierId,
        docType: { in: ["WORKMEN_COMPENSATION_INSURANCE", "WORKMEN_COMPENSATION"] },
      },
      select: { id: true, filename: true, expiryDate: true, uploadedAt: true },
      orderBy: { uploadedAt: "desc" },
    }),
  ]);

  return {
    employees,
    certificates: certificates.map((c) => ({
      id: c.id,
      filename: c.filename,
      expiryDate: c.expiryDate ? c.expiryDate.toISOString() : null,
      uploadedAt: c.uploadedAt.toISOString(),
    })),
  };
}

/** Opt a supplier in/out of the supplier portal (phone + one-time-code sign-in). */
export async function setSupplierPortalAction(formData: FormData): Promise<{ error: string | null }> {
  assertContactsValid(formData);
  await requirePermission("partners", "edit");
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("supplierId") || "");
  const enabled = formData.get("enabled") === "1";
  const supplier = await prisma.supplier.findUnique({ where: { id }, select: { branchId: true, portalEnabled: true, name: true } });
  if (!supplier || isOutsideBranch(supplier.branchId, branchId, isSuperAdmin)) return { error: "Supplier not found." };
  await prisma.supplier.update({ where: { id }, data: { portalEnabled: enabled } });
  await logAudit({
    entityType: "SUPPLIER",
    entityId: id,
    action: "UPDATE",
    before: { portalEnabled: supplier.portalEnabled },
    after: { portalEnabled: enabled },
    userId: user.id,
    userName: user.name,
    branchId: supplier.branchId,
  });
  revalidatePath(`/suppliers/${id}`);
  return { error: null };
}
