"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";

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

  const existing = await prisma.supplier.findUnique({ where: { name } });
  if (existing) {
    redirect(
      `/suppliers?error=${encodeURIComponent("A supplier with that name already exists.")}`
    );
  }

  const created = await prisma.supplier.create({ data: { name, fullName, branchId } });

  await logAudit({
    entityType: "SUPPLIER",
    entityId: created.id,
    action: "CREATE",
    after: { name, fullName },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath("/suppliers");
}

// Adds a subsidiary directly under a given parent — used by the chrome-tab
// "+" control on the supplier detail page, so parentSupplierId is always
// supplied by the caller (the tab strip's root) rather than picked by hand.
export async function createSubsidiaryAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const parentSupplierId = String(formData.get("parentSupplierId") || "").trim();
  const name = String(formData.get("name") || "").trim();
  if (!parentSupplierId || !name) return;

  if (!branchId) {
    redirect(
      `/suppliers/${parentSupplierId}?error=${encodeURIComponent(
        isSuperAdmin
          ? "Pick a branch from the switcher before adding a subsidiary."
          : "Your account has no branch assigned — contact an admin."
      )}`
    );
  }

  const parent = await prisma.supplier.findUnique({ where: { id: parentSupplierId } });
  if (!parent || isOutsideBranch(parent.branchId, branchId, isSuperAdmin)) {
    redirect(
      `/suppliers/${parentSupplierId}?error=${encodeURIComponent("Parent supplier not found.")}`
    );
  }

  const existing = await prisma.supplier.findUnique({ where: { name } });
  if (existing) {
    redirect(
      `/suppliers/${parentSupplierId}?error=${encodeURIComponent(
        "A supplier with that name already exists."
      )}`
    );
  }

  const created = await prisma.supplier.create({
    data: { name, parentSupplierId, branchId },
  });

  await logAudit({
    entityType: "SUPPLIER",
    entityId: created.id,
    action: "CREATE",
    after: { name, parentSupplierId },
    userId: user.id,
    userName: user.name,
    branchId,
  });

  revalidatePath(`/suppliers/${parentSupplierId}`);
  revalidatePath("/suppliers");
  redirect(`/suppliers/${created.id}`);
}

// Company & Compliance tab — every field this action writes lives in that
// tab's form, so a save here never touches Contact/Payment fields.
export async function updateSupplierCompanyAction(formData: FormData) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const id = String(formData.get("supplierId") || "");
  if (!id) return;

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing || isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) return;

  const parentSupplierIdRaw = stringOrNull(formData.get("parentSupplierId"));

  const data = {
    parentSupplierId: parentSupplierIdRaw === id ? null : parentSupplierIdRaw,
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
}

// Contact & Payment tab — every field this action writes lives in that
// tab's form, so a save here never touches Company/Compliance fields.
export async function updateSupplierContactPaymentAction(formData: FormData) {
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

export async function bulkImportSuppliersAction(rows: Record<string, string>[]) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const results: { row: number; status: "created" | "updated" | "error"; message?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const name = (r["Supplier name"] || "").trim();
    if (!name) {
      results.push({ row: i + 2, status: "error", message: "Supplier name is required." });
      continue;
    }
    if (!branchId) {
      results.push({ row: i + 2, status: "error", message: "No branch selected to import into." });
      continue;
    }
    try {
      const existing = await prisma.supplier.findUnique({ where: { name } });
      if (existing && isOutsideBranch(existing.branchId, branchId, isSuperAdmin)) {
        results.push({ row: i + 2, status: "error", message: "That name belongs to a different branch." });
        continue;
      }
      const data = {
        fullName: stringOrNull(r["Full name"] ?? null),
        contactPerson: stringOrNull(r["Contact person"] ?? null),
        contactPhone: stringOrNull(r["Contact phone"] ?? null),
        contactEmail: stringOrNull(r["Contact email"] ?? null),
        tradeLicenseNumber: stringOrNull(r["Trade license number"] ?? null),
      };
      if (existing) {
        const before = existing as unknown as Record<string, unknown>;
        await prisma.supplier.update({ where: { id: existing.id }, data });
        await logAudit({
          entityType: "SUPPLIER",
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
        const created = await prisma.supplier.create({ data: { name, ...data, branchId } });
        await logAudit({
          entityType: "SUPPLIER",
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

  revalidatePath("/suppliers");
  return results;
}

export async function deleteSupplierAction(formData: FormData) {
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
    const employee = await prisma.employee.create({
      data: {
        employeeIdNo,
        name,
        trade: r.designation?.trim() || null,
        position: r.category?.trim() || null,
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
      after: { employeeIdNo, name, trade: r.designation, position: r.category, supplierId },
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
