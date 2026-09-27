// Single source of truth for the 9 solution/pillar pages — the /solutions
// hub, sitemap.ts, and the manpower-ERP page's cross-link grid all read
// from this instead of keeping their own separate lists in sync by hand.
export const SOLUTIONS_DATA = [
  {
    slug: "manpower-erp-uae",
    label: "Manpower ERP",
    description: "The full platform: timesheets, WPS payroll, billing, compliance, camps and portals in one system.",
  },
  {
    slug: "wps-payroll-software-uae",
    label: "WPS payroll software",
    description: "Payroll from approved hours, with overtime, loans and gratuity applied automatically, exporting a bank-ready SIF file.",
  },
  {
    slug: "timesheet-software-construction-uae",
    label: "Timesheet software",
    description: "Excel, manual and supplier-submitted hours reconciled in one place, flowing straight into payroll and invoices.",
  },
  {
    slug: "construction-invoicing-software-uae",
    label: "Billing & VAT invoicing",
    description: "VAT-ready client invoices generated from the same approved hours as payroll, plus bills and expenses in one ledger.",
  },
  {
    slug: "manpower-demand-mobilization-software-uae",
    label: "Demand & mobilisation",
    description: "Every client request tracked from enquiry and quotation through mobilisation, site arrival and demobilisation.",
  },
  {
    slug: "camp-accommodation-management-software-uae",
    label: "Camp & accommodation",
    description: "Bed-level camp occupancy, check-in/out history, and transport routed against where crews are deployed today.",
  },
  {
    slug: "supplier-portal-software-uae",
    label: "Supplier portal",
    description: "Subcontractors submit their own workers, timesheets and track payments — no more spreadsheets by email.",
  },
  {
    slug: "employee-self-service-portal-uae",
    label: "Employee portal",
    description: "Payslips, attendance and personal documents, available to every worker from any phone browser.",
  },
  {
    slug: "ai-assistant-workforce-management",
    label: "AI assistant",
    description: "Ask your workforce data a plain-language question and get a permission-aware answer, linked to the record.",
  },
] as const;
