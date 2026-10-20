import { redirect } from "next/navigation";

export const metadata = { title: "Chart of accounts" };

/** The chart of accounts now lives under Reports. */
export default function AccountsPage() {
  redirect("/finance/books/reports?view=accounts");
}
