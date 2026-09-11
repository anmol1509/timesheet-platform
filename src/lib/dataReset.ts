import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Bulk per-module delete, for clearing out test data on the live database —
 * this app has no separate staging environment, so "testing" happens against
 * production and needs a safe way back to empty.
 *
 * `run` takes a Prisma client (the plain client, or a `$transaction` callback's
 * `tx`) rather than opening its own transaction, so a single-module reset
 * (wrapped in its own transaction by the caller) and "Reset All" (every
 * module's `run` given the SAME transaction, so the whole sequence is one
 * atomic unit) share the exact same per-module logic. `dependsOn` is shown in
 * the UI as a hint for which order avoids a foreign-key conflict — it isn't
 * enforced in code, since the transaction's atomicity already makes a wrong
 * order merely fail loudly (nothing deleted) rather than corrupt anything.
 */

type Db = Prisma.TransactionClient;

export type ResetModule = {
  id: string;
  label: string;
  description: string;
  /** False for data that was deliberately never split by branch (Camps, Vehicles). */
  branchScoped: boolean;
  /** Shown as a "reset these first" hint, not enforced. */
  dependsOn?: string[];
  count: (branchId: string | null) => Promise<number>;
  /** Returns a table -> rows-deleted breakdown for the confirmation summary. */
  run: (branchId: string | null, db: Db) => Promise<Record<string, number>>;
};

// The one order that satisfies every module's real dependsOn chain
// (nocs -> demand -> projects -> clients; suppliers -> timesheets); everything
// else is a leaf and can go anywhere relative to the others. Used by "Reset
// All" — resetting in this order never hits a foreign-key conflict.
export const SAFE_RESET_ORDER = [
  "nocs",
  "demand",
  "sales",
  "attendance",
  "timesheets",
  "billing",
  "inventory",
  "projects",
  "clients",
  "suppliers",
  "employees",
  "accommodation",
  "transport",
];

export const RESET_MODULES: ResetModule[] = [
  {
    id: "timesheets",
    label: "Timesheets",
    description: "Timesheet entries, generated sheets, and Excel upload history.",
    branchScoped: true,
    count: (branchId) => prisma.timesheetEntry.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId, db) => {
      const where = branchId ? { branchId } : {};
      const entries = await db.timesheetEntry.deleteMany({ where });
      const sheets = await db.generatedSheet.deleteMany({ where });
      const uploads = await db.upload.deleteMany({ where }); // cascades UploadMonth
      return { timesheetEntries: entries.count, generatedSheets: sheets.count, uploads: uploads.count };
    },
  },
  {
    id: "attendance",
    label: "Attendance",
    description: "Daily attendance records and correction requests.",
    branchScoped: true,
    count: (branchId) => prisma.attendance.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId, db) => {
      const where = branchId ? { branchId } : {};
      const res = await db.attendance.deleteMany({ where }); // cascades AttendanceCorrectionRequest
      return { attendance: res.count };
    },
  },
  {
    id: "demand",
    label: "Demand",
    description: "Demand requests, trade lines, and their employee allocations.",
    branchScoped: true,
    count: (branchId) => prisma.demandRequest.count({ where: branchId ? { branchId } : {} }),
    dependsOn: ["nocs"],
    run: async (branchId, db) => {
      const where = branchId ? { branchId } : {};
      const res = await db.demandRequest.deleteMany({ where }); // cascades trades + allocations
      return { demandRequests: res.count };
    },
  },
  {
    id: "sales",
    label: "Sales",
    description: "Enquiries and quotations.",
    branchScoped: true,
    count: (branchId) => prisma.enquiry.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId, db) => {
      const where = branchId ? { branchId } : {};
      const quotations = await db.quotation.deleteMany({ where }); // cascades QuotationLine
      const enquiries = await db.enquiry.deleteMany({ where });
      return { quotations: quotations.count, enquiries: enquiries.count };
    },
  },
  {
    id: "nocs",
    label: "NOCs & Letters",
    description: "Generated NOCs/undertakings and letter templates.",
    branchScoped: true,
    count: (branchId) => prisma.noc.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId, db) => {
      const where = branchId ? { branchId } : {};
      const nocs = await db.noc.deleteMany({ where }); // cascades NocEmployee
      const templates = await db.letterTemplate.deleteMany({ where });
      return { nocs: nocs.count, letterTemplates: templates.count };
    },
  },
  {
    id: "billing",
    label: "Billing",
    description: "Client invoices.",
    branchScoped: true,
    count: (branchId) => prisma.clientInvoice.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId, db) => {
      const where = branchId ? { branchId } : {};
      const res = await db.clientInvoice.deleteMany({ where });
      return { clientInvoices: res.count };
    },
  },
  {
    id: "accommodation",
    label: "Accommodation",
    description: "Camps, rooms, beds, check-ins, and accommodation history. Camps aren't split by branch, so this clears them for everyone.",
    branchScoped: false,
    count: () => prisma.camp.count(),
    run: async (_branchId, db) => {
      const checkIns = await db.campCheckIn.deleteMany({});
      const history = await db.accommodationHistory.deleteMany({});
      const rooms = await db.room.deleteMany({}); // cascades Bed
      const camps = await db.camp.deleteMany({});
      return { campCheckIns: checkIns.count, accommodationHistory: history.count, rooms: rooms.count, camps: camps.count };
    },
  },
  {
    id: "transport",
    label: "Transport",
    description: "Vehicles and routes. Not split by branch, so this clears them for everyone.",
    branchScoped: false,
    count: () => prisma.vehicle.count(),
    run: async (_branchId, db) => {
      const routes = await db.route.deleteMany({}); // cascades RouteStop
      const vehicles = await db.vehicle.deleteMany({}); // cascades VehicleProject
      return { routes: routes.count, vehicles: vehicles.count };
    },
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "Inventory items and their project assignments.",
    branchScoped: true,
    count: (branchId) => prisma.inventoryItem.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId, db) => {
      const where = branchId ? { branchId } : {};
      const items = await db.inventoryItem.findMany({ where, select: { id: true } });
      const itemIds = items.map((i) => i.id);
      const assignments = await db.projectInventoryAssignment.deleteMany({ where: { itemId: { in: itemIds } } });
      const deleted = await db.inventoryItem.deleteMany({ where });
      return { assignments: assignments.count, items: deleted.count };
    },
  },
  {
    id: "projects",
    label: "Projects",
    description: "Projects, sites, LPOs, and their documents/contacts/holidays. Unlinks (doesn't delete) employees/timesheets/attendance/quotations pointing at them.",
    branchScoped: true,
    dependsOn: ["demand"],
    count: (branchId) => prisma.project.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId, db) => {
      const where = branchId ? { branchId } : {};
      const projects = await db.project.findMany({ where, select: { id: true } });
      const projectIds = projects.map((p) => p.id);
      await db.employee.updateMany({ where: { projectId: { in: projectIds } }, data: { projectId: null } });
      await db.timesheetEntry.updateMany({ where: { projectId: { in: projectIds } }, data: { projectId: null } });
      await db.attendance.updateMany({ where: { projectId: { in: projectIds } }, data: { projectId: null } });
      await db.quotation.updateMany({ where: { projectId: { in: projectIds } }, data: { projectId: null } });
      const deleted = await db.project.deleteMany({ where }); // cascades Site/Lpo/ProjectDocument/ProjectHoliday/ProjectContact/ProjectInventoryAssignment
      return { projects: deleted.count };
    },
  },
  {
    id: "clients",
    label: "Clients",
    description: "Clients and their trade rates, documents, contacts. Deletes invoices/enquiries/quotations for these clients first; fails if a project or demand request still references one.",
    branchScoped: true,
    dependsOn: ["demand", "projects"],
    count: (branchId) => prisma.client.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId, db) => {
      const where = branchId ? { branchId } : {};
      const clients = await db.client.findMany({ where, select: { id: true } });
      const clientIds = clients.map((c) => c.id);
      await db.timesheetEntry.updateMany({ where: { clientId: { in: clientIds } }, data: { clientId: null } });
      await db.clientInvoice.deleteMany({ where: { clientId: { in: clientIds } } });
      await db.quotation.deleteMany({ where: { clientId: { in: clientIds } } });
      await db.enquiry.deleteMany({ where: { clientId: { in: clientIds } } });
      const deleted = await db.client.deleteMany({ where }); // cascades ClientTradeRate/ClientDocument/ClientContact
      return { clients: deleted.count };
    },
  },
  {
    id: "suppliers",
    label: "Suppliers",
    description: "Suppliers and subsidiaries. Unlinks employees and attendance first; fails if timesheet entries or generated sheets still reference one.",
    branchScoped: true,
    dependsOn: ["timesheets"],
    count: (branchId) => prisma.supplier.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId, db) => {
      const where = branchId ? { branchId } : {};
      const suppliers = await db.supplier.findMany({ where, select: { id: true } });
      const supplierIds = suppliers.map((s) => s.id);
      await db.employee.updateMany({ where: { supplierId: { in: supplierIds } }, data: { supplierId: null } });
      await db.employee.updateMany({ where: { sponsorSupplierId: { in: supplierIds } }, data: { sponsorSupplierId: null } });
      await db.attendance.updateMany({ where: { supplierId: { in: supplierIds } }, data: { supplierId: null } });
      const deleted = await db.supplier.deleteMany({ where });
      return { suppliers: deleted.count };
    },
  },
  {
    id: "employees",
    label: "Employees",
    description: "Employees and all their records (documents, history, skills). Frees any bed, unlinks any check-in/attendance/allocation first, so this doesn't need other modules reset first.",
    branchScoped: true,
    count: (branchId) => prisma.employee.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId, db) => {
      const where = branchId ? { branchId } : {};
      const employees = await db.employee.findMany({ where, select: { id: true } });
      const employeeIds = employees.map((e) => e.id);
      await db.bed.updateMany({ where: { employeeId: { in: employeeIds } }, data: { employeeId: null } });
      await db.campCheckIn.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await db.demandRequestAllocation.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await db.nocEmployee.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await db.attendance.deleteMany({ where: { employeeId: { in: employeeIds } } }); // cascades AttendanceCorrectionRequest
      const deleted = await db.employee.deleteMany({ where }); // cascades notes/history/visa/labour/vaccination/skills/documents
      return { employees: deleted.count };
    },
  },
];
