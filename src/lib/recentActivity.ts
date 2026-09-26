import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";

export type RecentActivityRow = {
  id: string;
  entityType: string;
  action: string;
  userName: string;
  createdAt: Date;
};

export async function getRecentActivity(branchId: string | null, take = 6): Promise<RecentActivityRow[]> {
  return prisma.auditLog.findMany({
    where: branchWhere(branchId),
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, entityType: true, action: true, userName: true, createdAt: true },
  });
}

const ENTITY_LABEL: Record<string, string> = {
  EMPLOYEE: "employee",
  EMPLOYEE_NOTE: "employee note",
  EMPLOYEE_SITE_ARRIVAL: "site arrival",
  EMPLOYEE_DEMOBILISATION: "demobilisation",
  DOCUMENT: "document",
  CLIENT_INVOICE: "invoice",
  DEMAND_REQUEST: "labour request",
  PROJECT: "project",
  TIMESHEET_ENTRY: "timesheet",
  ATTENDANCE: "attendance",
  ATTENDANCE_CORRECTION: "attendance correction",
  CANDIDATE_ONBOARDING: "candidate",
  PAYROLL_RUN: "payroll run",
  PAYROLL_LINE: "payroll line",
  SUPPLIER: "supplier",
  SUPPLIER_BILL: "supplier bill",
  CLIENT: "client",
  QUOTATION: "quotation",
  ENQUIRY: "enquiry",
  EXPENSE: "expense",
  CAMP: "camp",
  CAMP_CHECK_IN: "camp check-in",
  VEHICLE: "vehicle",
  ROUTE: "transport route",
  INVENTORY_ITEM: "inventory item",
  ISSUED_LETTER: "letter",
  UPLOAD: "timesheet upload",
  VISA_APPLICATION: "visa application",
  LABOUR_CARD_APPLICATION: "labour card application",
  EMPLOYEE_LOAN: "loan / advance",
};

const ACTION_VERB: Record<string, string> = { CREATE: "added", UPDATE: "updated", DELETE: "removed" };

export function activityLabel(row: RecentActivityRow): string {
  const entity = ENTITY_LABEL[row.entityType] ?? row.entityType.replace(/_/g, " ").toLowerCase();
  const verb = ACTION_VERB[row.action] ?? row.action.toLowerCase();
  const label = `${entity} ${verb}`;
  return label.charAt(0).toUpperCase() + label.slice(1);
}
