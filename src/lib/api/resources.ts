import { prisma } from "@/lib/db";
import { getRenewals } from "@/lib/renewals";
import { type ApiContext, hasScope } from "./auth";
import { dateParam, day, finishPage, money, pageArgs, stamp } from "./respond";

/**
 * What /api/v1 serves. Each response is written out field by field instead of
 * returning database rows, so a column added to the app later is not published
 * by accident, and personal or pay data only appears behind its own scope.
 * Every query is pinned to the key's branch.
 */

export type Result = { status: 200; body: unknown } | { status: 400 | 404; code: string; message: string };
const bad = (message: string): Result => ({ status: 400, code: "invalid_parameter", message });
const notFound = (what: string): Result => ({ status: 404, code: "not_found", message: `${what} not found.` });
const ok = (body: unknown): Result => ({ status: 200, body });

export type Route = { scope: string; run: (ctx: ApiContext, q: URLSearchParams, id?: string, sub?: string) => Promise<Result> };

// ---------------------------------------------------------------- employees
const employeeSelect = {
  id: true, employeeIdNo: true, name: true, status: true, category: true, trade: true, position: true, nationality: true, gender: true,
  supplierId: true, sponsorSupplierId: true, projectId: true, joinDate: true, siteArrivalDate: true, passportExpiry: true, emiratesIdExpiry: true,
  laborCardExpiry: true, visaExpiry: true, medicalExpiry: true, updatedAt: true,
  dateOfBirth: true, passportNumber: true, emiratesId: true, laborCardNumber: true, mobileNumber: true, whatsappNumber: true, molPersonCode: true, visaNumber: true,
} as const;

function employeeOut(e: Awaited<ReturnType<typeof loadEmployee>>, pii: boolean) {
  if (!e) return null;
  return {
    id: e.id, employee_code: e.employeeIdNo, name: e.name, status: e.status, category: e.category, trade: e.trade ?? e.position, nationality: e.nationality, gender: e.gender,
    supplier_id: e.supplierId, sponsor_supplier_id: e.sponsorSupplierId, project_id: e.projectId, join_date: day(e.joinDate), site_arrival_date: day(e.siteArrivalDate),
    passport_expiry: day(e.passportExpiry), emirates_id_expiry: day(e.emiratesIdExpiry), labour_card_expiry: day(e.laborCardExpiry), visa_expiry: day(e.visaExpiry),
    medical_expiry: day(e.medicalExpiry), updated_at: stamp(e.updatedAt),
    ...(pii
      ? {
          date_of_birth: day(e.dateOfBirth), passport_number: e.passportNumber, emirates_id: e.emiratesId, labour_card_number: e.laborCardNumber,
          mobile_number: e.mobileNumber, whatsapp_number: e.whatsappNumber, mol_person_code: e.molPersonCode, visa_number: e.visaNumber,
        }
      : {}),
  };
}
const loadEmployee = (branchId: string, id: string) => prisma.employee.findFirst({ where: { id, branchId }, select: employeeSelect });

const employees: Route = {
  scope: "employees:read",
  async run(ctx, q, id) {
    const pii = hasScope(ctx, "employees:pii");
    if (id) {
      const e = await loadEmployee(ctx.branchId, id);
      return e ? ok({ data: employeeOut(e, pii) }) : notFound("Employee");
    }
    const since = dateParam(q, "updated_since");
    if (since === undefined) return bad("updated_since must be a date, e.g. 2026-09-01 or 2026-09-01T08:00:00Z.");
    const { limit, args } = pageArgs(q);
    const rows = await prisma.employee.findMany({
      where: {
        branchId: ctx.branchId,
        ...(q.get("supplier_id") ? { supplierId: q.get("supplier_id")! } : {}),
        ...(q.get("project_id") ? { projectId: q.get("project_id")! } : {}),
        ...(q.get("status") ? { status: q.get("status") as never } : {}),
        ...(since ? { updatedAt: { gte: since } } : {}),
      },
      select: employeeSelect,
      ...args,
    });
    const page = finishPage(rows, limit);
    return ok({ data: page.data.map((e) => employeeOut(e, pii)), next_cursor: page.next_cursor });
  },
};

// ---------------------------------------------------------------- suppliers
const supplierSelect = {
  id: true, name: true, code: true, fullName: true, status: true, trn: true, tradeLicenseNumber: true, tradeLicenseExpiry: true, category: true, country: true, emirate: true,
  isOwnCompany: true, parentSupplierId: true, contactPerson: true, contactPhone: true, contactEmail: true, paymentTerms: true, approvalStatus: true, labourApprovalStatus: true, invoiceApprovalStatus: true,
} as const;
const supplierOut = (s: NonNullable<Awaited<ReturnType<typeof loadSupplier>>>) => ({
  id: s.id, name: s.name, code: s.code, full_name: s.fullName, status: s.status, trn: s.trn, trade_license_number: s.tradeLicenseNumber, trade_license_expiry: day(s.tradeLicenseExpiry),
  category: s.category, country: s.country, emirate: s.emirate, is_own_company: s.isOwnCompany, parent_supplier_id: s.parentSupplierId, contact_person: s.contactPerson,
  contact_phone: s.contactPhone, contact_email: s.contactEmail, payment_terms: s.paymentTerms, approval_status: s.approvalStatus, labour_approval_status: s.labourApprovalStatus, invoice_approval_status: s.invoiceApprovalStatus,
});
const loadSupplier = (branchId: string, id: string) => prisma.supplier.findFirst({ where: { id, branchId }, select: supplierSelect });

const suppliers: Route = {
  scope: "suppliers:read",
  async run(ctx, q, id) {
    if (id) {
      const s = await loadSupplier(ctx.branchId, id);
      return s ? ok({ data: supplierOut(s) }) : notFound("Supplier");
    }
    const { limit, args } = pageArgs(q);
    const rows = await prisma.supplier.findMany({ where: { branchId: ctx.branchId }, select: supplierSelect, ...args });
    const page = finishPage(rows, limit);
    return ok({ data: page.data.map(supplierOut), next_cursor: page.next_cursor });
  },
};

// ------------------------------------------------------------------ clients
const clientSelect = {
  id: true, name: true, code: true, status: true, trn: true, tradeLicenseNumber: true, tradeLicenseExpiry: true, country: true, emirate: true, currency: true,
  paymentTerms: true, retentionPercent: true, contractStart: true, contractEnd: true, contactPerson: true, contactPhone: true, contactEmail: true,
} as const;
const clientOut = (c: NonNullable<Awaited<ReturnType<typeof loadClient>>>) => ({
  id: c.id, name: c.name, code: c.code, status: c.status, trn: c.trn, trade_license_number: c.tradeLicenseNumber, trade_license_expiry: day(c.tradeLicenseExpiry), country: c.country,
  emirate: c.emirate, currency: c.currency, payment_terms: c.paymentTerms, retention_percent: c.retentionPercent, contract_start: day(c.contractStart), contract_end: day(c.contractEnd),
  contact_person: c.contactPerson, contact_phone: c.contactPhone, contact_email: c.contactEmail,
});
const loadClient = (branchId: string, id: string) => prisma.client.findFirst({ where: { id, branchId }, select: clientSelect });

const clients: Route = {
  scope: "clients:read",
  async run(ctx, q, id) {
    if (id) {
      const c = await loadClient(ctx.branchId, id);
      return c ? ok({ data: clientOut(c) }) : notFound("Client");
    }
    const { limit, args } = pageArgs(q);
    const rows = await prisma.client.findMany({ where: { branchId: ctx.branchId }, select: clientSelect, ...args });
    const page = finishPage(rows, limit);
    return ok({ data: page.data.map(clientOut), next_cursor: page.next_cursor });
  },
};

// ----------------------------------------------------------------- projects
const projectSelect = {
  id: true, code: true, name: true, status: true, clientId: true, clientProjectNo: true, timelineStart: true, timelineEnd: true, jobType: true, mainContractor: true,
  noOfEmployeesRequired: true, weeklyOffDays: true, latitude: true, longitude: true,
} as const;
const projectOut = (p: NonNullable<Awaited<ReturnType<typeof loadProject>>>) => ({
  id: p.id, code: p.code, name: p.name, status: p.status, client_id: p.clientId, client_project_no: p.clientProjectNo, start_date: day(p.timelineStart), end_date: day(p.timelineEnd),
  job_type: p.jobType, main_contractor: p.mainContractor, employees_required: p.noOfEmployeesRequired, weekly_off_days: p.weeklyOffDays, latitude: p.latitude, longitude: p.longitude,
});
const loadProject = (branchId: string, id: string) => prisma.project.findFirst({ where: { id, branchId }, select: projectSelect });

const projects: Route = {
  scope: "projects:read",
  async run(ctx, q, id) {
    if (id) {
      const p = await loadProject(ctx.branchId, id);
      return p ? ok({ data: projectOut(p) }) : notFound("Project");
    }
    const { limit, args } = pageArgs(q);
    const rows = await prisma.project.findMany({ where: { branchId: ctx.branchId, ...(q.get("client_id") ? { clientId: q.get("client_id")! } : {}) }, select: projectSelect, ...args });
    const page = finishPage(rows, limit);
    return ok({ data: page.data.map(projectOut), next_cursor: page.next_cursor });
  },
};

// --------------------------------------------------------------- attendance
const attendance: Route = {
  scope: "attendance:read",
  async run(ctx, q, id) {
    if (id) return notFound("Route");
    const from = dateParam(q, "from");
    const to = dateParam(q, "to");
    const since = dateParam(q, "updated_since");
    if (from === undefined || to === undefined || since === undefined) return bad("from, to and updated_since must be dates, e.g. 2026-09-01.");
    const { limit, args } = pageArgs(q);
    const emp = q.get("employee_code");
    const rows = await prisma.attendance.findMany({
      where: {
        branchId: ctx.branchId,
        ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
        ...(since ? { updatedAt: { gte: since } } : {}),
        ...(q.get("status") ? { status: q.get("status")! } : {}),
        ...(q.get("employee_id") ? { employeeId: q.get("employee_id")! } : {}),
        ...(emp ? { employee: { employeeIdNo: emp } } : {}),
      },
      select: { id: true, date: true, status: true, normalHours: true, otHours: true, employeeId: true, projectId: true, supplierId: true, updatedAt: true, employee: { select: { employeeIdNo: true } } },
      ...args,
    });
    const page = finishPage(rows, limit);
    return ok({
      data: page.data.map((a) => ({
        id: a.id, date: day(a.date), employee_id: a.employeeId, employee_code: a.employee.employeeIdNo, status: a.status, normal_hours: a.normalHours, ot_hours: a.otHours,
        project_id: a.projectId, supplier_id: a.supplierId, updated_at: stamp(a.updatedAt),
      })),
      next_cursor: page.next_cursor,
    });
  },
};

// --------------------------------------------------------------- timesheets
const timesheets: Route = {
  scope: "timesheets:read",
  async run(ctx, q, id) {
    if (id) return notFound("Route");
    const month = q.get("month");
    if (month && !/^\d{4}-\d{2}$/.test(month)) return bad("month must look like 2026-09.");
    const since = dateParam(q, "updated_since");
    if (since === undefined) return bad("updated_since must be a date.");
    const { limit, args } = pageArgs(q);
    const rows = await prisma.timesheetEntry.findMany({
      where: {
        branchId: ctx.branchId,
        ...(month ? { month } : {}),
        ...(q.get("supplier_id") ? { supplierId: q.get("supplier_id")! } : {}),
        ...(q.get("client_id") ? { clientId: q.get("client_id")! } : {}),
        ...(q.get("status") ? { status: q.get("status")! } : {}),
        ...(since ? { updatedAt: { gte: since } } : {}),
      },
      select: { id: true, month: true, employeeIdNo: true, employeeName: true, trade: true, rate: true, totalHours: true, absentCount: true, absentDeduction: true, invoiceValue: true, status: true, supplierId: true, clientId: true, projectId: true, updatedAt: true },
      ...args,
    });
    const page = finishPage(rows, limit);
    return ok({
      data: page.data.map((t) => ({
        id: t.id, month: t.month, employee_code: t.employeeIdNo, employee_name: t.employeeName, trade: t.trade, rate: t.rate, total_hours: t.totalHours, absent_days: t.absentCount,
        absent_deduction: t.absentDeduction, invoice_value: t.invoiceValue, status: t.status, supplier_id: t.supplierId, client_id: t.clientId, project_id: t.projectId, updated_at: stamp(t.updatedAt),
      })),
      next_cursor: page.next_cursor,
    });
  },
};

// ----------------------------------------------------------------- invoices
const invoices: Route = {
  scope: "invoices:read",
  async run(ctx, q, id) {
    if (id) return notFound("Route");
    const month = q.get("month");
    if (month && !/^\d{4}-\d{2}$/.test(month)) return bad("month must look like 2026-09.");
    const { limit, args } = pageArgs(q);
    const rows = await prisma.clientInvoice.findMany({
      where: { branchId: ctx.branchId, ...(month ? { month } : {}), ...(q.get("client_id") ? { clientId: q.get("client_id")! } : {}), ...(q.get("status") ? { status: q.get("status")! } : {}) },
      select: { id: true, invoiceNumber: true, month: true, clientId: true, subtotal: true, vatAmount: true, totalAmount: true, status: true, issueDate: true, dueDate: true, paidDate: true },
      ...args,
    });
    const page = finishPage(rows, limit);
    return ok({
      data: page.data.map((i) => ({
        id: i.id, invoice_number: i.invoiceNumber, month: i.month, client_id: i.clientId, subtotal: money(i.subtotal), vat_amount: money(i.vatAmount), total_amount: money(i.totalAmount),
        status: i.status, issue_date: day(i.issueDate), due_date: day(i.dueDate), paid_date: day(i.paidDate),
      })),
      next_cursor: page.next_cursor,
    });
  },
};

// ----------------------------------------------------------------- renewals
const renewals: Route = {
  scope: "renewals:read",
  async run(ctx, q, id) {
    if (id) return notFound("Route");
    const raw = Number(q.get("within_days"));
    const horizon = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 365) : 90;
    const items = await getRenewals(ctx.branchId, horizon);
    return ok({
      data: items.map((i) => ({
        subject_type: i.kind, subject_id: i.subjectId, subject_name: i.subjectName, subject_ref: i.subjectRef, document: i.document, expiry_date: i.expiry.slice(0, 10), days_remaining: i.days, tier: i.tier,
      })),
      next_cursor: null,
    });
  },
};

// ------------------------------------------------------------------ payroll
const payroll: Route = {
  scope: "payroll:read",
  async run(ctx, q, id, sub) {
    if (id && sub === "lines") {
      const run = await prisma.payrollRun.findFirst({ where: { id, branchId: ctx.branchId }, select: { id: true } });
      if (!run) return notFound("Payroll run");
      const { limit, args } = pageArgs(q);
      const rows = await prisma.payrollLine.findMany({
        where: { runId: run.id },
        select: {
          id: true, employeeId: true, payStructure: true, daysInMonth: true, absentDays: true, idleDays: true, sickDays: true, normalHours: true, otHours: true, restHours: true,
          basic: true, allowances: true, overtimePay: true, deductions: true, gasCharge: true, adjustment: true, otherEarnings: true, otherDeductions: true, manualDeduction: true,
          loanDeduction: true, net: true, paymentStatus: true, employee: { select: { employeeIdNo: true, name: true } },
        },
        ...args,
      });
      const page = finishPage(rows, limit);
      return ok({
        data: page.data.map((l) => ({
          id: l.id, employee_id: l.employeeId, employee_code: l.employee.employeeIdNo, employee_name: l.employee.name, pay_structure: l.payStructure, days_in_month: l.daysInMonth,
          absent_days: l.absentDays, idle_days: l.idleDays, sick_days: l.sickDays, normal_hours: l.normalHours, overtime_hours: l.otHours, rest_day_hours: l.restHours,
          basic: money(l.basic), allowances: money(l.allowances), overtime_pay: money(l.overtimePay), deductions: money(l.deductions), gas_charge: money(l.gasCharge),
          adjustment: money(l.adjustment), other_earnings: money(l.otherEarnings), other_deductions: money(l.otherDeductions), manual_deduction: money(l.manualDeduction),
          loan_deduction: money(l.loanDeduction), net: money(l.net), payment_status: l.paymentStatus,
        })),
        next_cursor: page.next_cursor,
      });
    }
    if (id) return notFound("Route");
    const month = q.get("month");
    if (month && !/^\d{4}-\d{2}$/.test(month)) return bad("month must look like 2026-09.");
    const { limit, args } = pageArgs(q);
    const rows = await prisma.payrollRun.findMany({
      where: { branchId: ctx.branchId, ...(month ? { month } : {}), ...(q.get("status") ? { status: q.get("status")! } : {}) },
      select: { id: true, month: true, status: true, companyId: true, payType: true, submittedAt: true, approvedAt: true, paidAt: true, createdAt: true },
      ...args,
    });
    const page = finishPage(rows, limit);
    return ok({
      data: page.data.map((r) => ({
        id: r.id, month: r.month, status: r.status, company_id: r.companyId, pay_type: r.payType, submitted_at: stamp(r.submittedAt), approved_at: stamp(r.approvedAt), paid_at: stamp(r.paidAt), created_at: stamp(r.createdAt),
      })),
      next_cursor: page.next_cursor,
    });
  },
};

/** path → route. A path that is not here is a 404, so nothing is served by default. */
export function resolveRoute(segments: string[]): { route: Route; id?: string; sub?: string } | null {
  const lists: Record<string, Route> = { employees, suppliers, clients, projects, attendance, timesheets, invoices, renewals };
  const withId: Record<string, Route> = { employees, suppliers, clients, projects };
  const [a, b, c, d] = segments;
  if (segments.length === 1 && lists[a]) return { route: lists[a] };
  if (segments.length === 2 && withId[a]) return { route: withId[a], id: b };
  if (a === "payroll" && b === "runs") {
    if (segments.length === 2) return { route: payroll };
    if (segments.length === 4 && d === "lines") return { route: payroll, id: c, sub: "lines" };
  }
  return null;
}
