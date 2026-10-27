"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission, requireUserWithBranch, requireWrite } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";
import { logAudit } from "@/lib/audit";
import { payColumns, payFieldsFor, payInputFromRate, payRevision, structuresFor } from "@/lib/payFields";

type Result = { error: string | null; ok?: boolean };

async function worker(employeeId: string) {
  const { user, branchId, isSuperAdmin } = await requireUserWithBranch();
  const e = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, name: true, branchId: true } });
  return e && !isOutsideBranch(e.branchId, branchId, isSuperAdmin) ? { user, e } : null;
}

/** The three WPS details (or Cash) from the profile's status panel, so a worker is fixed where the problem is shown. */
export async function setEmployeeBankAction(employeeId: string, formData: FormData): Promise<Result> {
  await requireWrite("workforce.employees");
  await requirePermission("payroll.payroll", "edit");
  const w = await worker(employeeId);
  if (!w) return { error: "Employee not found." };
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { wpsPaymentMode: true, wpsBankName: true, wpsRoutingCode: true, wpsIban: true, molPersonCode: true, branchId: true } });
  if (!emp) return { error: "Employee not found." };
  const mode = String(formData.get("mode") || "BANK");
  let data: { wpsPaymentMode: string; wpsBankName?: string | null; wpsRoutingCode?: string | null; wpsIban?: string | null; molPersonCode?: string | null };
  if (mode === "CASH") {
    data = { wpsPaymentMode: "Cash" };
  } else {
    const personCode = String(formData.get("personCode") || "").replace(/\s+/g, "");
    const routing = String(formData.get("routingCode") || "").replace(/\s+/g, "");
    const iban = String(formData.get("wpsIban") || "").replace(/\s+/g, "").toUpperCase();
    if (!personCode) return { error: "Enter the worker's MOL person code (from their labour card)." };
    if (!/^\d{9}$/.test(routing)) return { error: "The bank routing code has 9 digits." };
    if (!iban) return { error: "Enter the worker's IBAN." };
    data = { wpsPaymentMode: /cash/i.test(emp.wpsPaymentMode ?? "") || !emp.wpsPaymentMode ? "Bank transfer" : emp.wpsPaymentMode, molPersonCode: personCode, wpsRoutingCode: routing, wpsIban: iban, wpsBankName: String(formData.get("bankName") || "").trim() || emp.wpsBankName };
  }
  await prisma.employee.update({ where: { id: employeeId }, data });
  await logAudit({ entityType: "EMPLOYEE", entityId: employeeId, action: "UPDATE", before: { wpsPaymentMode: emp.wpsPaymentMode, hadRouting: !!emp.wpsRoutingCode, hadIban: !!emp.wpsIban, hadPersonCode: !!emp.molPersonCode }, after: { wpsPaymentMode: data.wpsPaymentMode, via: "profile status panel", ibanLast4: data.wpsIban ? data.wpsIban.slice(-4) : null }, userId: w.user.id, userName: w.user.name, branchId: emp.branchId });
  revalidatePath(`/employees/${employeeId}`);
  return { error: null, ok: true };
}

/** How the worker is paid, from the profile's status panel: the company's pay type decides which structures are allowed. */
export async function setEmployeePayAction(employeeId: string, entry: { structure: "FLAT" | "ITEMISED" | "HOURLY"; rate: number | null; housing?: number | null; food?: number | null; transport?: number | null; other?: number | null }): Promise<Result> {
  await requireWrite("workforce.employees");
  await requirePermission("payroll.payroll", "edit");
  const w = await worker(employeeId);
  if (!w) return { error: "Employee not found." };
  const before = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, branchId: true, payStructure: true, basicSalary: true, housingAllowance: true, foodAllowance: true, transportAllowance: true, otherAllowance: true, flatMonthlyRate: true, hourlyRate: true, supplier: { select: { isOwnCompany: true, payType: true } }, sponsorSupplier: { select: { isOwnCompany: true, payType: true } } },
  });
  if (!before) return { error: "Employee not found." };
  const company = before.supplier?.isOwnCompany && before.sponsorSupplier?.isOwnCompany ? before.sponsorSupplier : before.supplier;
  if (!structuresFor(company?.payType ?? null).includes(entry.structure)) return { error: company?.payType === "HOURLY" ? "This company pays by the hour, so choose Hourly." : "This company pays a monthly salary, so choose Flat or Itemised." };
  const pay = payFieldsFor(payInputFromRate(entry.structure, entry.rate, { housing: entry.housing, food: entry.food, transport: entry.transport, other: entry.other }));
  if ("error" in pay) return { error: pay.error };
  const columns = payColumns(pay.fields);
  await prisma.employee.update({ where: { id: employeeId }, data: { ...columns, payOverride: true } });
  const revision = payRevision(before, columns);
  if (revision) {
    await prisma.salaryRevision.create({ data: { employeeId, branchId: before.branchId, effectiveFrom: new Date(), reason: "Pay set from the profile status panel", before: revision.before, after: revision.after, fixedBefore: revision.fixedBefore, fixedAfter: revision.fixedAfter, createdById: w.user.id, createdByName: w.user.name } });
  }
  await logAudit({ entityType: "EMPLOYEE", entityId: employeeId, action: "UPDATE", before: { payStructure: before.payStructure }, after: { ...columns, via: "profile status panel" }, userId: w.user.id, userName: w.user.name, branchId: before.branchId });
  revalidatePath(`/employees/${employeeId}`);
  return { error: null, ok: true };
}
