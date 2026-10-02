/** What a customer can subscribe to. Anything not listed here is never sent. */
export const WEBHOOK_EVENTS = [
  { type: "employee.created", label: "Employee added", description: "A worker or staff member was added." },
  { type: "employee.updated", label: "Employee changed", description: "An employee's record was edited. Lists which fields changed, not their values." },
  { type: "supplier.created", label: "Supplier added", description: "A supplier was added." },
  { type: "timesheet.approved", label: "Timesheet approved", description: "A timesheet entry was approved." },
  { type: "payroll.run_approved", label: "Payroll approved", description: "A payroll run was approved." },
  { type: "invoice.issued", label: "Invoice issued", description: "A client invoice was issued." },
  { type: "document.expiring", label: "Document expiring", description: "A passport, visa, labour card or similar reaches 60, 30, 14, 7 or 1 days to expiry, or expires today." },
  { type: "import.completed", label: "Import finished", description: "A bulk import finished." },
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number]["type"];
export const EVENT_TYPES: string[] = WEBHOOK_EVENTS.map((e) => e.type);
export const isEventType = (v: string): v is WebhookEventType => EVENT_TYPES.includes(v);
/** Sent only to the endpoint it was triggered for, from the Developers page. */
export const TEST_EVENT = "webhook.test";
