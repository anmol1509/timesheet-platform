"use client";

import { CountrySelect } from "@/components/ui/CountrySelect";
import { PhoneField } from "@/components/ui/PhoneField";
import { keepInput } from "@/lib/vendor/keepInput";
import { useActionState, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Badge } from "@/components/Badge";
import { submitWorkerAction, withdrawWorkerAction } from "./actions";

type State = { error: string | null; ok?: boolean };
export type SubmissionRow = { id: string; name: string; trade: string; status: string; note: string | null; submittedAt: string };

const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block"><span className="mb-1 block text-xs font-medium text-muted">{t}</span>{children}</label>;

function WorkerForm({ trades, onDone }: { trades: string[]; onDone: () => void }) {
  const [state, action, pending] = useActionState(
    async (p: State, fd: FormData) => { const r = await submitWorkerAction(p, fd); if (r.ok) onDone(); return r; },
    { error: null } as State
  );
  return (
    <form onSubmit={keepInput(action)} className="mt-4 space-y-4">
      <fieldset className="space-y-3"><legend className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Personal</legend>
        <div className="grid grid-cols-3 gap-3">
          <L t="First name *"><input name="firstName" required className="input w-full" /></L>
          <L t="Middle name"><input name="middleName" className="input w-full" /></L>
          <L t="Last name *"><input name="lastName" required className="input w-full" /></L>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <L t="Date of birth *"><input type="date" name="dateOfBirth" required className="input w-full" /></L>
          <L t="Gender"><select name="gender" defaultValue="" className="input w-full"><option value="">—</option><option value="MALE">Male</option><option value="FEMALE">Female</option></select></L>
          <L t="Nationality"><CountrySelect name="nationality" placeholder="Select nationality…" /></L>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <L t="Mobile"><PhoneField name="mobileNumber" /></L>
          <L t="Blood group"><input name="bloodGroup" className="input w-full" placeholder="e.g. O+" /></L>
          <L t="Join date"><input type="date" name="joinDate" className="input w-full" /></L>
        </div>
      </fieldset>
      <fieldset className="space-y-3"><legend className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Job</legend>
        <L t="Trade *"><select name="trade" required defaultValue="" className="input w-full"><option value="" disabled>Choose a trade…</option>{trades.map((t) => <option key={t} value={t}>{t}</option>)}</select></L>
      </fieldset>
      <fieldset className="space-y-3"><legend className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Documents</legend>
        <div className="grid grid-cols-2 gap-3">
          <L t="Passport number *"><input name="passportNumber" required className="input w-full" /></L>
          <L t="Passport expiry"><input type="date" name="passportExpiry" className="input w-full" /></L>
          <L t="Emirates ID / ICP number *"><input name="emiratesId" required className="input w-full" /></L>
          <L t="Emirates ID expiry"><input type="date" name="emiratesIdExpiry" className="input w-full" /></L>
          <L t="Visa expiry"><input type="date" name="visaExpiry" className="input w-full" /></L>
          <L t="Labour card expiry"><input type="date" name="laborCardExpiry" className="input w-full" /></L>
          <L t="Medical expiry"><input type="date" name="medicalExpiry" className="input w-full" /></L>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <L t="Passport copy"><input type="file" name="passportFile" accept="application/pdf,image/jpeg,image/png" className="file-input w-full" /></L>
          <L t="Emirates ID / ICP copy"><input type="file" name="emiratesIdFile" accept="application/pdf,image/jpeg,image/png" className="file-input w-full" /></L>
          <L t="Other document"><input type="file" name="otherFile" accept="application/pdf,image/jpeg,image/png" className="file-input w-full" /></L>
        </div>
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Sending…" : "Send for approval"}</button>
        {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
      </div>
      <p className="text-xs text-subtle">The worker joins your list once our team approves. You&apos;ll see the decision here.</p>
    </form>
  );
}

export function AddWorker({ trades, enabled }: { trades: string[]; enabled: boolean }) {
  const [open, setOpen] = useState(false);
  if (!enabled) return <p className="max-w-xs text-xs text-muted">Adding workers isn&apos;t enabled for your company yet. Please contact us.</p>;
  return (
    <>
      <button type="button" className="btn btn-primary gap-1.5" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden /> Add a worker</button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl!" title="Add a worker" description="Enter what you have. Fields marked * are required."><WorkerForm trades={trades} onDone={() => setOpen(false)} /></DialogContent>
      </Dialog>
    </>
  );
}

export function SubmissionList({ rows }: { rows: SubmissionRow[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (rows.length === 0) return null;
  return (
    <section className="card overflow-hidden">
      <div className="border-b border-default px-5 py-3"><h2 className="text-sm font-semibold text-primary">Sent for approval</h2></div>
      {error && <p role="alert" className="px-5 pt-3 text-sm text-[var(--error)]">{error}</p>}
      <ul className="divide-y divide-[var(--border)]">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-primary">{r.name} <span className="font-normal text-muted">· {r.trade}</span></p>
              <p className="text-xs text-muted">Sent {r.submittedAt}{r.status === "REJECTED" && r.note ? ` · Reason: ${r.note}` : ""}</p>
            </div>
            <span className="flex items-center gap-3">
              <Badge color={r.status === "REJECTED" ? "red" : "amber"} dot>{r.status === "REJECTED" ? "Not approved" : "Awaiting approval"}</Badge>
              {r.status === "PENDING" && (
                <button type="button" disabled={pending} className="text-xs font-medium text-[var(--error)] hover:underline"
                  onClick={() => start(async () => { setError(null); const fd = new FormData(); fd.set("id", r.id); const res = await withdrawWorkerAction(fd); if (res.error) setError(res.error); })}>Withdraw</button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
