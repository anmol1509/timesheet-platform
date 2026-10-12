import { prisma } from "@/lib/db";

type Entry = { id: string; entityType: string; entityId: string; changes: unknown };

const idIn = (changes: unknown, key: string): string | null => {
  const raw = changes && typeof changes === "object" ? (changes as Record<string, unknown>)[key] : null;
  const v = raw && typeof raw === "object" && "to" in (raw as object) ? (raw as { to: unknown }).to : raw;
  return typeof v === "string" && v ? v : null;
};

/** Records that belong to one employee are described by that employee ("for Rahul Khan"). */
const EMPLOYEE_OWNED = new Set(["DOCUMENT", "ACCOMMODATION", "EMPLOYEE_INVENTORY_ASSIGNMENT", "EMPLOYEE_SITE_ARRIVAL", "EMPLOYEE_DEMOBILISATION", "EMPLOYEE_NOTE", "ATTENDANCE_CORRECTION"]);

/**
 * Looks up the current name of what each audit entry is about, in a handful of queries for the whole page.
 * A record that has since been deleted simply has no name here; the sentence falls back to the entry's own snapshot.
 */
export async function auditNames(entries: Entry[]): Promise<Record<string, string>> {
  const ids = (type: string) => [...new Set(entries.filter((e) => e.entityType === type).map((e) => e.entityId))];
  const byEmployeeKey = entries.filter((e) => EMPLOYEE_OWNED.has(e.entityType)).map((e) => ({ e, empId: idIn(e.changes, "employeeId") }));
  const employeeIds = [...new Set([...ids("EMPLOYEE"), ...byEmployeeKey.flatMap((x) => (x.empId ? [x.empId] : []))])];

  const [employees, suppliers, clients, projects, users, runs, loans, settlements] = await Promise.all([
    employeeIds.length ? prisma.employee.findMany({ where: { id: { in: employeeIds } }, select: { id: true, name: true } }) : [],
    ids("SUPPLIER").length ? prisma.supplier.findMany({ where: { id: { in: ids("SUPPLIER") } }, select: { id: true, name: true } }) : [],
    ids("CLIENT").length ? prisma.client.findMany({ where: { id: { in: ids("CLIENT") } }, select: { id: true, name: true } }) : [],
    ids("PROJECT").length ? prisma.project.findMany({ where: { id: { in: ids("PROJECT") } }, select: { id: true, name: true } }) : [],
    ids("USER").length ? prisma.user.findMany({ where: { id: { in: ids("USER") } }, select: { id: true, name: true } }) : [],
    ids("PAYROLL_RUN").length ? prisma.payrollRun.findMany({ where: { id: { in: ids("PAYROLL_RUN") } }, select: { id: true, month: true, company: { select: { name: true } } } }) : [],
    ids("EMPLOYEE_LOAN").length ? prisma.employeeLoan.findMany({ where: { id: { in: ids("EMPLOYEE_LOAN") } }, select: { id: true, employee: { select: { name: true } } } }) : [],
    ids("FINAL_SETTLEMENT").length ? prisma.finalSettlement.findMany({ where: { id: { in: ids("FINAL_SETTLEMENT") } }, select: { id: true, employee: { select: { name: true } } } }) : [],
  ]);

  const emp = new Map(employees.map((x) => [x.id, x.name]));
  const simple = new Map<string, string>([...suppliers, ...clients, ...projects, ...users].map((x) => [x.id, x.name]));
  const out: Record<string, string> = {};
  for (const e of entries) {
    let name: string | undefined;
    if (e.entityType === "EMPLOYEE") name = emp.get(e.entityId);
    else if (e.entityType === "PAYROLL_RUN") { const r = runs.find((x) => x.id === e.entityId); if (r) name = `${r.company?.name ?? "payroll"} ${r.month}`; }
    else if (e.entityType === "EMPLOYEE_LOAN") { const l = loans.find((x) => x.id === e.entityId); if (l) name = `for ${l.employee.name}`; }
    else if (e.entityType === "FINAL_SETTLEMENT") { const s = settlements.find((x) => x.id === e.entityId); if (s) name = `for ${s.employee.name}`; }
    else if (EMPLOYEE_OWNED.has(e.entityType)) { const id = idIn(e.changes, "employeeId"); const n = id ? emp.get(id) : undefined; if (n) name = `for ${n}`; }
    else name = simple.get(e.entityId);
    if (name) out[e.id] = name;
  }
  return out;
}
