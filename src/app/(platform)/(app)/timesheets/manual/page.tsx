import { redirect } from "next/navigation";

export const metadata = { title: "Manual timesheet" };

export default function ManualTimesheetEntryPage() {
  redirect("/invoices/client-timesheet/new");
}
