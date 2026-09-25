/** How audit entries read to a person: a plain label, the module it belongs to, and where to open the record. Pure — usable from client components. */
type Meta = { label: string; module: string; href?: (id: string) => string };

const M = (label: string, module: string, href?: (id: string) => string): Meta => ({ label, module, href });

export const ENTITY_META: Record<string, Meta> = {
  EMPLOYEE: M("Employee", "Workforce", (id) => `/employees/${id}`),
  EMPLOYEE_NOTE: M("Employee note", "Workforce"),
  EMPLOYEE_LOAN: M("Loan or advance", "Payroll", () => "/payroll/loans"),
  EMPLOYEE_INVENTORY_ASSIGNMENT: M("Issued item", "Inventory"),
  EMPLOYEE_SITE_ARRIVAL: M("Site arrival", "Demand"),
  EMPLOYEE_DEMOBILISATION: M("Demobilisation", "Demand"),
  DOCUMENT: M("Document", "Workforce"),
  VISA_APPLICATION: M("Visa application", "Workforce"),
  LABOUR_CARD_APPLICATION: M("Labour card", "Workforce"),
  SKILL: M("Trade", "Workforce", () => "/trades"),
  PROJECT: M("Project", "Projects", (id) => `/projects/${id}`),
  PROJECT_DOCUMENT: M("Project document", "Projects"),
  SITE: M("Site", "Projects"),
  LPO: M("LPO", "Projects"),
  NOC: M("NOC", "Projects", (id) => `/operations/nocs/${id}`),
  CLIENT: M("Client", "Business partners", (id) => `/clients/${id}`),
  CLIENT_DOCUMENT: M("Client document", "Business partners"),
  CLIENT_INVOICE: M("Invoice", "Billing"),
  SUPPLIER: M("Supplier", "Business partners", (id) => `/suppliers/${id}`),
  SUPPLIER_CHANGE_REQUEST: M("Supplier change request", "Business partners", () => "/suppliers/requests"),
  SUPPLIER_TICKET: M("Supplier message", "Business partners", () => "/suppliers/tickets"),
  WORKER_SUBMISSION: M("Worker submission", "Business partners", () => "/suppliers/requests"),
  PORTAL_CONTACT: M("Portal contact", "Business partners", () => "/suppliers/contacts"),
  ENQUIRY: M("Enquiry", "Sales", () => "/sales/enquiries"),
  QUOTATION: M("Quotation", "Sales", (id) => `/sales/quotations/${id}`),
  DEMAND_REQUEST: M("Demand request", "Demand", (id) => `/demand/${id}`),
  DEMAND_REQUEST_ALLOCATION: M("Allocation", "Demand"),
  ATTENDANCE: M("Attendance", "Timesheets", () => "/attendance"),
  ATTENDANCE_CORRECTION: M("Attendance correction", "Timesheets", () => "/approvals?type=CORRECTION"),
  TIMESHEET_ENTRY: M("Timesheet", "Timesheets", () => "/invoices/client-timesheet"),
  UPLOAD: M("Timesheet upload", "Timesheets", (id) => `/upload/${id}`),
  CAMP: M("Camp", "Facilities", () => "/accommodation/camps"),
  ROOM: M("Room", "Facilities", () => "/accommodation/camps"),
  BED: M("Bed", "Facilities", () => "/accommodation/camps"),
  ACCOMMODATION: M("Accommodation", "Facilities", () => "/accommodation/camps"),
  CAMP_CHECK_IN: M("Check-in", "Facilities", () => "/accommodation/checkin"),
  VEHICLE: M("Vehicle", "Facilities", (id) => `/transport/${id}`),
  ROUTE: M("Route", "Facilities", (id) => `/transport/routes/${id}`),
  INVENTORY_ITEM: M("Inventory item", "Inventory", (id) => `/inventory/${id}`),
  INVENTORY_VARIANT: M("Inventory variant", "Inventory"),
  PAYROLL_RUN: M("Payroll run", "Payroll", (id) => `/payroll/${id}`),
  PAYROLL_LINE: M("Payroll line", "Payroll"),
  PAYROLL_ADJUSTMENT: M("Payroll adjustment", "Payroll"),
  EXPENSE: M("Expense", "Finance", () => "/finance/expenses"),
  EXPENSE_BUDGET: M("Expense budget", "Finance", () => "/finance/expenses"),
  PETTY_CASH: M("Petty cash", "Finance", () => "/finance/expenses"),
  SUPPLIER_BILL: M("Supplier bill", "Finance", () => "/finance/bills"),
  BILL_PAYMENT: M("Bill payment", "Finance", () => "/finance/bills"),
  BANK: M("Bank account", "Finance", (id) => `/banks/${id}`),
  LETTER_TEMPLATE: M("Letter template", "Letters", () => "/letter-templates"),
  ISSUED_LETTER: M("Issued letter", "Letters", () => "/letters"),
  USER: M("Team member", "Administration", () => "/settings/team"),
  ACCESS_ROLE: M("Role", "Administration", () => "/settings/roles"),
  BRANCH: M("Branch", "Administration", () => "/settings"),
  SETTINGS: M("Settings", "Administration", () => "/settings"),
  LOOKUP_VALUE: M("Lookup value", "Administration", () => "/lookups"),
  DATA_RESET: M("Data reset", "Administration", () => "/settings/data-reset"),
};

export function entityMeta(type: string): Meta {
  return ENTITY_META[type] ?? { label: type.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), module: "Other" };
}

export const AUDIT_MODULES = [...new Set(Object.values(ENTITY_META).map((m) => m.module))].sort();

const VERB: Record<string, string> = { CREATE: "created", UPDATE: "updated", DELETE: "deleted" };
export const auditVerb = (action: string) => VERB[action] ?? action.toLowerCase();

/** "employeeIdNo" -> "Employee id no" */
export function fieldLabel(key: string) {
  const s = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
