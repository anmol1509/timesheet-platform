import { prisma } from "@/lib/db";
import { emitWebhookEvent, hasSubscribers } from "./deliver";

type Audit = {
  entityType: string;
  entityId: string;
  action: string;
  after?: Record<string, unknown> | null;
  changes?: object | null;
  branchId?: string | null;
};

const PAY_FIELDS = /salary|allowance|rate|wps|iban|account|paystructure|basic|multiplier|dailyhours|weeklyoff|paysovertime|payoverride|bank|passwordhash/i;
const snake = (k: string) => k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

/** Which event, if any, a change recorded in the audit log amounts to. No database work until we know someone is listening. */
function eventFor(a: Audit): string | null {
  if (a.entityType === "EMPLOYEE" && a.action === "CREATE") return "employee.created";
  if (a.entityType === "EMPLOYEE" && a.action === "UPDATE") return "employee.updated";
  if (a.entityType === "SUPPLIER" && a.action === "CREATE") return "supplier.created";
  if (a.entityType === "PAYROLL_RUN" && a.action === "UPDATE" && a.after?.status === "APPROVED") return "payroll.run_approved";
  if (a.entityType === "TIMESHEET_ENTRY" && a.action === "UPDATE" && a.after?.status === "APPROVED") return "timesheet.approved";
  return null;
}

/** Called from logAudit after each recorded change. Events carry ids and a few reference fields only; the receiver fetches details through the API. */
export async function emitFromAudit(a: Audit) {
  if (!a.branchId) return;
  const type = eventFor(a);
  if (!type || !(await hasSubscribers(a.branchId, type))) return;

  let data: Record<string, unknown> | null = null;
  if (type.startsWith("employee.")) {
    const e = await prisma.employee.findUnique({ where: { id: a.entityId }, select: { id: true, employeeIdNo: true, status: true, supplierId: true, projectId: true } });
    if (!e) return;
    data = { employee_id: e.id, employee_code: e.employeeIdNo, status: e.status, supplier_id: e.supplierId, project_id: e.projectId };
    if (type === "employee.updated") data.changed_fields = Object.keys(a.changes ?? {}).filter((k) => !PAY_FIELDS.test(k)).map(snake);
  } else if (type === "supplier.created") {
    const s = await prisma.supplier.findUnique({ where: { id: a.entityId }, select: { id: true, code: true, name: true } });
    if (!s) return;
    data = { supplier_id: s.id, code: s.code, name: s.name };
  } else if (type === "payroll.run_approved") {
    const r = await prisma.payrollRun.findUnique({ where: { id: a.entityId }, select: { id: true, month: true, companyId: true } });
    if (!r) return;
    data = { run_id: r.id, month: r.month, company_id: r.companyId };
  } else if (type === "timesheet.approved") {
    const t = await prisma.timesheetEntry.findUnique({ where: { id: a.entityId }, select: { id: true, month: true, employeeIdNo: true, supplierId: true } });
    if (!t) return;
    data = { timesheet_id: t.id, month: t.month, employee_code: t.employeeIdNo, supplier_id: t.supplierId };
  }
  if (data) await emitWebhookEvent(a.branchId, type, data);
}
