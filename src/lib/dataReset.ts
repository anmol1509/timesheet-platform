import { prisma } from "@/lib/db";

/**
 * Bulk per-module delete, for clearing out test data on the live database —
 * this app has no separate staging environment, so "testing" happens against
 * production and needs a safe way back to empty.
 *
 * Every module's `run` is one Prisma transaction: either everything in it
 * deletes, or (on a foreign-key conflict from a module that hasn't been
 * reset yet) nothing does. `dependsOn` is shown in the UI as a hint for
 * which order avoids that conflict — it isn't enforced in code, since the
 * transaction's atomicity already makes a wrong order merely fail loudly
 * rather than corrupt anything.
 */

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
  run: (branchId: string | null) => Promise<Record<string, number>>;
};

export const RESET_MODULES: ResetModule[] = [
  {
    id: "timesheets",
    label: "Timesheets",
    description: "Timesheet entries, generated sheets, and Excel upload history.",
    branchScoped: true,
    count: (branchId) => prisma.timesheetEntry.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId) => {
      const where = branchId ? { branchId } : {};
      return prisma.$transaction(async (tx) => {
        const entries = await tx.timesheetEntry.deleteMany({ where });
        const sheets = await tx.generatedSheet.deleteMany({ where });
        const uploads = await tx.upload.deleteMany({ where }); // cascades UploadMonth
        return { timesheetEntries: entries.count, generatedSheets: sheets.count, uploads: uploads.count };
      });
    },
  },
  {
    id: "attendance",
    label: "Attendance",
    description: "Daily attendance records and correction requests.",
    branchScoped: true,
    count: (branchId) => prisma.attendance.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId) => {
      const where = branchId ? { branchId } : {};
      const res = await prisma.attendance.deleteMany({ where }); // cascades AttendanceCorrectionRequest
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
    run: async (branchId) => {
      const where = branchId ? { branchId } : {};
      const res = await prisma.demandRequest.deleteMany({ where }); // cascades trades + allocations
      return { demandRequests: res.count };
    },
  },
  {
    id: "sales",
    label: "Sales",
    description: "Enquiries and quotations.",
    branchScoped: true,
    count: (branchId) => prisma.enquiry.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId) => {
      const where = branchId ? { branchId } : {};
      return prisma.$transaction(async (tx) => {
        const quotations = await tx.quotation.deleteMany({ where }); // cascades QuotationLine
        const enquiries = await tx.enquiry.deleteMany({ where });
        return { quotations: quotations.count, enquiries: enquiries.count };
      });
    },
  },
  {
    id: "nocs",
    label: "NOCs & Letters",
    description: "Generated NOCs/undertakings and letter templates.",
    branchScoped: true,
    count: (branchId) => prisma.noc.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId) => {
      const where = branchId ? { branchId } : {};
      return prisma.$transaction(async (tx) => {
        const nocs = await tx.noc.deleteMany({ where }); // cascades NocEmployee
        const templates = await tx.letterTemplate.deleteMany({ where });
        return { nocs: nocs.count, letterTemplates: templates.count };
      });
    },
  },
  {
    id: "billing",
    label: "Billing",
    description: "Client invoices.",
    branchScoped: true,
    count: (branchId) => prisma.clientInvoice.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId) => {
      const where = branchId ? { branchId } : {};
      const res = await prisma.clientInvoice.deleteMany({ where });
      return { clientInvoices: res.count };
    },
  },
  {
    id: "accommodation",
    label: "Accommodation",
    description: "Camps, rooms, beds, check-ins, and accommodation history. Camps aren't split by branch, so this clears them for everyone.",
    branchScoped: false,
    count: () => prisma.camp.count(),
    run: async () => {
      return prisma.$transaction(async (tx) => {
        const checkIns = await tx.campCheckIn.deleteMany({});
        const history = await tx.accommodationHistory.deleteMany({});
        const rooms = await tx.room.deleteMany({}); // cascades Bed
        const camps = await tx.camp.deleteMany({});
        return { campCheckIns: checkIns.count, accommodationHistory: history.count, rooms: rooms.count, camps: camps.count };
      });
    },
  },
  {
    id: "transport",
    label: "Transport",
    description: "Vehicles and routes. Not split by branch, so this clears them for everyone.",
    branchScoped: false,
    count: () => prisma.vehicle.count(),
    run: async () => {
      return prisma.$transaction(async (tx) => {
        const routes = await tx.route.deleteMany({}); // cascades RouteStop
        const vehicles = await tx.vehicle.deleteMany({}); // cascades VehicleProject
        return { routes: routes.count, vehicles: vehicles.count };
      });
    },
  },
  {
    id: "inventory",
    label: "Inventory",
    description: "Inventory items and their project assignments.",
    branchScoped: true,
    count: (branchId) => prisma.inventoryItem.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId) => {
      const where = branchId ? { branchId } : {};
      return prisma.$transaction(async (tx) => {
        const items = await tx.inventoryItem.findMany({ where, select: { id: true } });
        const itemIds = items.map((i) => i.id);
        const assignments = await tx.projectInventoryAssignment.deleteMany({ where: { itemId: { in: itemIds } } });
        const deleted = await tx.inventoryItem.deleteMany({ where });
        return { assignments: assignments.count, items: deleted.count };
      });
    },
  },
  {
    id: "projects",
    label: "Projects",
    description: "Projects, sites, LPOs, and their documents/contacts/holidays. Unlinks (doesn't delete) employees/timesheets/attendance/quotations pointing at them.",
    branchScoped: true,
    dependsOn: ["demand"],
    count: (branchId) => prisma.project.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId) => {
      const where = branchId ? { branchId } : {};
      return prisma.$transaction(async (tx) => {
        const projects = await tx.project.findMany({ where, select: { id: true } });
        const projectIds = projects.map((p) => p.id);
        await tx.employee.updateMany({ where: { projectId: { in: projectIds } }, data: { projectId: null } });
        await tx.timesheetEntry.updateMany({ where: { projectId: { in: projectIds } }, data: { projectId: null } });
        await tx.attendance.updateMany({ where: { projectId: { in: projectIds } }, data: { projectId: null } });
        await tx.quotation.updateMany({ where: { projectId: { in: projectIds } }, data: { projectId: null } });
        const deleted = await tx.project.deleteMany({ where }); // cascades Site/Lpo/ProjectDocument/ProjectHoliday/ProjectContact/ProjectInventoryAssignment
        return { projects: deleted.count };
      });
    },
  },
  {
    id: "clients",
    label: "Clients",
    description: "Clients and their trade rates, documents, contacts. Deletes invoices/enquiries/quotations for these clients first; fails if a project or demand request still references one.",
    branchScoped: true,
    dependsOn: ["demand", "projects"],
    count: (branchId) => prisma.client.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId) => {
      const where = branchId ? { branchId } : {};
      return prisma.$transaction(async (tx) => {
        const clients = await tx.client.findMany({ where, select: { id: true } });
        const clientIds = clients.map((c) => c.id);
        await tx.timesheetEntry.updateMany({ where: { clientId: { in: clientIds } }, data: { clientId: null } });
        await tx.clientInvoice.deleteMany({ where: { clientId: { in: clientIds } } });
        await tx.quotation.deleteMany({ where: { clientId: { in: clientIds } } });
        await tx.enquiry.deleteMany({ where: { clientId: { in: clientIds } } });
        const deleted = await tx.client.deleteMany({ where }); // cascades ClientTradeRate/ClientDocument/ClientContact
        return { clients: deleted.count };
      });
    },
  },
  {
    id: "suppliers",
    label: "Suppliers",
    description: "Suppliers and subsidiaries. Unlinks employees and attendance first; fails if timesheet entries or generated sheets still reference one.",
    branchScoped: true,
    dependsOn: ["timesheets"],
    count: (branchId) => prisma.supplier.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId) => {
      const where = branchId ? { branchId } : {};
      return prisma.$transaction(async (tx) => {
        const suppliers = await tx.supplier.findMany({ where, select: { id: true } });
        const supplierIds = suppliers.map((s) => s.id);
        await tx.employee.updateMany({ where: { supplierId: { in: supplierIds } }, data: { supplierId: null } });
        await tx.employee.updateMany({ where: { sponsorSupplierId: { in: supplierIds } }, data: { sponsorSupplierId: null } });
        await tx.attendance.updateMany({ where: { supplierId: { in: supplierIds } }, data: { supplierId: null } });
        const deleted = await tx.supplier.deleteMany({ where });
        return { suppliers: deleted.count };
      });
    },
  },
  {
    id: "employees",
    label: "Employees",
    description: "Employees and all their records (documents, history, skills). Frees any bed, unlinks any check-in/attendance/allocation first, so this doesn't need other modules reset first.",
    branchScoped: true,
    count: (branchId) => prisma.employee.count({ where: branchId ? { branchId } : {} }),
    run: async (branchId) => {
      const where = branchId ? { branchId } : {};
      return prisma.$transaction(async (tx) => {
        const employees = await tx.employee.findMany({ where, select: { id: true } });
        const employeeIds = employees.map((e) => e.id);
        await tx.bed.updateMany({ where: { employeeId: { in: employeeIds } }, data: { employeeId: null } });
        await tx.campCheckIn.deleteMany({ where: { employeeId: { in: employeeIds } } });
        await tx.demandRequestAllocation.deleteMany({ where: { employeeId: { in: employeeIds } } });
        await tx.nocEmployee.deleteMany({ where: { employeeId: { in: employeeIds } } });
        await tx.attendance.deleteMany({ where: { employeeId: { in: employeeIds } } }); // cascades AttendanceCorrectionRequest
        const deleted = await tx.employee.deleteMany({ where }); // cascades notes/history/visa/labour/vaccination/skills/documents
        return { employees: deleted.count };
      });
    },
  },
];
