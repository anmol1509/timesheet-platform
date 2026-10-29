"use client";

import { useState, useTransition } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { setupBooksAction } from "./actions";

/** First-run card: the date the books start from. Everything before it is brought in as opening balances. */
export function SetupCard({ isAdmin }: { isAdmin: boolean }) {
  const [date, setDate] = useState(`${new Date().getUTCFullYear()}-01-01`);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="mx-auto max-w-xl rounded-[var(--radius-card)] border border-default bg-surface p-8 text-center">
      <BookOpen className="mx-auto h-8 w-8 text-muted" aria-hidden />
      <h2 className="mt-3 text-lg font-semibold text-primary">Start your accounting</h2>
      <p className="mt-1 text-sm text-muted">
        Invoices, supplier bills, expenses and payroll post by themselves from the date you choose. Anything before it comes in as opening balances, which you can import from Tally, Excel, Zoho Books or QuickBooks.
      </p>
      {isAdmin ? (
        <div className="mt-6 space-y-3">
          <label className="block text-left text-sm font-medium text-primary">
            Accounting starts on
            <div className="mt-1"><DatePicker value={date} onChange={setDate} ariaLabel="Accounting starts on" fromYear={2015} toYear={new Date().getUTCFullYear() + 1} /></div>
          </label>
          {error && <p role="alert" className="text-left text-sm text-error">{error}</p>}
          <Button type="button" disabled={pending} onClick={() => start(async () => { const r = await setupBooksAction(date); if (r.error) setError(r.error); })} loading={pending}>
            Start accounting
          </Button>
        </div>
      ) : (
        <p className="mt-6 text-sm text-secondary">An admin needs to start accounting first.</p>
      )}
    </div>
  );
}
