"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fixBankDetailsAction } from "../actions";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { Hint } from "@/components/Hint";

/** "Fix now" beside a worker whose bank details are incomplete: fill the three WPS details, or mark them as paid in cash. */
export function BankFix({ runId, employeeId, name, defaults }: { runId: string; employeeId: string; name: string; defaults: { personCode: string; routingCode: string; iban: string; bankName: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit(e: React.FormEvent<HTMLFormElement>, mode: "BANK" | "CASH") {
    e.preventDefault();
    const form = (e.currentTarget as HTMLElement).closest("form") as HTMLFormElement;
    const fd = new FormData(form);
    fd.set("runId", runId); fd.set("employeeId", employeeId); fd.set("mode", mode);
    setError(null);
    start(async () => {
      const r = await fixBankDetailsAction(fd);
      if (r.error) setError(r.error); else { setOpen(false); router.refresh(); }
    });
  }
  if (!open) return <button type="button" className="ml-2 text-xs font-medium text-[var(--brand-primary)] hover:underline" onClick={() => setOpen(true)}>Fix now</button>;
  return (
    <form onSubmit={(e) => submit(e, "BANK")} className="mt-2 grid gap-2 rounded-md border border-default bg-surface p-3 sm:grid-cols-2" aria-label={`Bank details for ${name}`}>
      <label className="block text-xs text-muted">MOL person code <Hint term="MOL_PERSON_CODE" />
        <input name="personCode" defaultValue={defaults.personCode} className="input mt-1 h-9 w-full text-sm" inputMode="numeric" />
      </label>
      <label className="block text-xs text-muted">Bank routing code (9 digits) <Hint term="ROUTING_CODE" />
        <input name="routingCode" defaultValue={defaults.routingCode} className="input mt-1 h-9 w-full text-sm" inputMode="numeric" maxLength={9} />
      </label>
      <label className="block text-xs text-muted sm:col-span-2">IBAN <Hint term="IBAN" />
        <MaskedInput kind="iban" name="wpsIban" defaultValue={defaults.iban} className="input mt-1 h-9 w-full text-sm" />
      </label>
      <label className="block text-xs text-muted sm:col-span-2">Bank name (optional)
        <input name="bankName" defaultValue={defaults.bankName} className="input mt-1 h-9 w-full text-sm" />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="btn btn-primary h-8 px-3 text-xs">{pending ? "Saving…" : "Save and recalculate"}</button>
        <button type="button" disabled={pending} className="text-xs font-medium text-secondary hover:underline" onClick={(e) => submit(e as unknown as React.FormEvent<HTMLFormElement>, "CASH")}>Paid in cash instead</button>
        <button type="button" className="text-xs text-muted hover:underline" onClick={() => setOpen(false)}>Cancel</button>
        {error && <p role="alert" className="w-full text-xs text-[var(--error)]">{error}</p>}
      </div>
    </form>
  );
}
