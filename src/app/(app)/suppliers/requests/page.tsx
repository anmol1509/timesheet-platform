import { redirect } from "next/navigation";

// New workers and detail changes from suppliers are decided in the Approvals inbox.
export default function SupplierRequestsPage() {
  redirect("/approvals?type=WORKER");
}
