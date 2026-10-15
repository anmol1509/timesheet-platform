import { redirect } from "next/navigation";

export default function ManualTimesheetEntryPage() {
  redirect("/invoices/client-timesheet/new");
}
