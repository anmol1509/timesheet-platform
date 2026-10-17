import { redirect } from "next/navigation";

/** The chart of accounts now lives under Reports. */
export default function AccountsPage() {
  redirect("/finance/books/reports?view=accounts");
}
