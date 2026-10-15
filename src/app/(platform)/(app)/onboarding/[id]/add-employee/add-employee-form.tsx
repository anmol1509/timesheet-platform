"use client";

import { useActionState, useRef, useState, startTransition } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { PhoneField } from "@/components/ui/PhoneField";
import { SaveWarnings } from "@/components/SaveWarnings";
import { TRADES } from "@/lib/trades";
import { addCandidateAsEmployeeAction, type AddEmployeeState } from "../../add-employee-actions";

type Opt = { id: string; name: string };
type FileRow = { id: string; name: string; docType: string; expiry: string };
type Initial = {
  name: string; supplierId: string; projectId: string; trade: string; nationality: string; gender: string; bloodGroup: string; mobileNumber: string;
  dateOfBirth: string; passportNumber: string; emiratesId: string; joinDate: string; visaNumber: string; visaExpiry: string; medicalExpiry: string;
};

const lbl = "mb-1 block text-xs font-medium text-muted";
const TRADE_OPTIONS = [{ value: "", label: "Not set" }, ...TRADES.map((t) => ({ value: t, label: t }))];
const GENDER = [{ value: "", label: "Not set" }, { value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }];
const BLOOD = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => ({ value: v, label: v || "Not set" }));
const PAY = [
  { value: "LATER", label: "Set later" }, { value: "FLAT", label: "Monthly salary (one figure)" },
  { value: "ITEMISED", label: "Basic salary plus allowances" }, { value: "HOURLY", label: "Hourly rate" },
];
const DOC_LABEL: Record<string, string> = { PASSPORT: "Passport", VISA: "Visa", MEDICAL: "Medical", INSURANCE: "Insurance", OTHER: "Other" };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2 border-b border-default pb-2">
        <span className="text-sm font-medium text-primary">{title}</span>
        {hint && <span className="text-xs text-muted">— {hint}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

export function AddEmployeeForm({ candidateId, ready, canEditPay, proposedId, suppliers, projects, files, initial }: {
  candidateId: string; ready: boolean; canEditPay: boolean; proposedId: string; suppliers: Opt[]; projects: Opt[]; files: FileRow[]; initial: Initial;
}) {
  const [state, action, pending] = useActionState(async (_p: AddEmployeeState, fd: FormData) => addCandidateAsEmployeeAction(_p, fd), { error: null } as AddEmployeeState);
  const formRef = useRef<HTMLFormElement>(null);
  const [payChoice, setPayChoice] = useState("LATER");
  const [dismissed, setDismissed] = useState<unknown>(null);

  if (state.employeeId) {
    return (
      <div className="card space-y-3 p-6">
        <p className="flex items-center gap-2 text-base font-semibold text-primary"><CheckCircle2 className="h-5 w-5 text-[var(--success)]" aria-hidden />{initial.name} has been added to employees</p>
        {files.length > 0 && <p className="text-sm text-muted">{state.copiedFiles ?? 0} of {files.length} file{files.length === 1 ? "" : "s"} copied to their documents.</p>}
        <p className="text-sm text-secondary">What usually comes next:</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/employees/${state.employeeId}`} className="btn btn-primary">Open the employee</Link>
          <Link href="/accommodation/bed-allocation" className="btn btn-secondary">Assign a bed</Link>
          <Link href={`/employees/${state.employeeId}`} className="btn btn-secondary">Place on a project or issue PPE</Link>
          <Link href={`/onboarding/${candidateId}`} className="btn btn-secondary">Back to the candidate</Link>
        </div>
      </div>
    );
  }

  const resend = () => {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    fd.set("confirmWarnings", "1");
    startTransition(() => action(fd));
  };

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="id" value={candidateId} />

      <Section title="The person">
        <label className="block"><span className={lbl}>Full name *</span><input name="name" defaultValue={initial.name} required className="input w-full" /></label>
        <label className="block"><span className={lbl}>Employee ID <span className="font-normal">(leave blank to generate{proposedId ? `, e.g. ${proposedId}` : ""})</span></span><input name="employeeIdNo" className="input w-full" /></label>
        <label className="block"><span className={lbl}>Passport number *</span><input name="passportNumber" defaultValue={initial.passportNumber} className="input w-full" /></label>
        <label className="block"><span className={lbl}>Emirates ID <span className="font-normal">(optional until issued)</span></span><input name="emiratesId" defaultValue={initial.emiratesId} placeholder="784-…" className="input w-full" /></label>
        <label className="block"><span className={lbl}>Nationality</span><CountrySelect name="nationality" defaultValue={initial.nationality} /></label>
        <label className="block"><span className={lbl}>Date of birth</span><DatePicker name="dateOfBirth" defaultValue={initial.dateOfBirth} className="w-full" /></label>
        <label className="block"><span className={lbl}>Gender</span><Select name="gender" defaultValue={initial.gender} searchable={false} options={GENDER} /></label>
        <label className="block"><span className={lbl}>Blood group</span><Select name="bloodGroup" defaultValue={initial.bloodGroup} searchable={false} options={BLOOD} /></label>
        <label className="block"><span className={lbl}>Mobile</span><PhoneField name="mobileNumber" defaultValue={initial.mobileNumber} /></label>
      </Section>

      <Section title="Work" hint="where they will be paid from and placed">
        <label className="block"><span className={lbl}>Company *</span><Select name="supplierId" defaultValue={initial.supplierId} searchable placeholder="Choose the company" options={suppliers.map((s) => ({ value: s.id, label: s.name }))} /></label>
        <label className="block"><span className={lbl}>Visa sponsor <span className="font-normal">(if different)</span></span><Select name="sponsorSupplierId" defaultValue="" searchable placeholder="Same as the company" options={[{ value: "", label: "Same as the company" }, ...suppliers.map((s) => ({ value: s.id, label: s.name }))]} /></label>
        <label className="block"><span className={lbl}>Trade</span><Select name="trade" defaultValue={initial.trade} searchable options={TRADE_OPTIONS} /></label>
        <label className="block"><span className={lbl}>Project</span><Select name="projectId" defaultValue={initial.projectId} searchable placeholder="Not placed yet" options={[{ value: "", label: "Not placed yet" }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} /></label>
        <label className="block"><span className={lbl}>Joining date</span><DatePicker name="joinDate" defaultValue={initial.joinDate} className="w-full" /></label>
      </Section>

      <Section title="Papers so far" hint="from the onboarding steps; update any that are wrong">
        <label className="block"><span className={lbl}>Visa number</span><input name="visaNumber" defaultValue={initial.visaNumber} className="input w-full" /></label>
        <label className="block"><span className={lbl}>Visa expiry</span><DatePicker name="visaExpiry" defaultValue={initial.visaExpiry} className="w-full" /></label>
        <label className="block"><span className={lbl}>Medical expiry</span><DatePicker name="medicalExpiry" defaultValue={initial.medicalExpiry} className="w-full" /></label>
        <label className="block"><span className={lbl}>Passport expiry</span><DatePicker name="passportExpiry" defaultValue="" className="w-full" /></label>
        <label className="block"><span className={lbl}>Emirates ID expiry</span><DatePicker name="emiratesIdExpiry" defaultValue="" className="w-full" /></label>
        <label className="block"><span className={lbl}>Labour card expiry</span><DatePicker name="laborCardExpiry" defaultValue="" className="w-full" /></label>
      </Section>

      {canEditPay ? (
        <Section title="Pay" hint="you can also set this later from the employee">
          <label className="block sm:col-span-2"><span className={lbl}>How are they paid?</span><Select name="payChoice" value={payChoice} onChange={setPayChoice} searchable={false} options={PAY} /></label>
          {payChoice === "FLAT" && <label className="block"><span className={lbl}>Monthly salary (AED)</span><input name="flat" type="number" min={0} step="0.01" className="input w-full" /></label>}
          {payChoice === "HOURLY" && <label className="block"><span className={lbl}>Hourly rate (AED)</span><input name="hourly" type="number" min={0} step="0.01" className="input w-full" /></label>}
          {payChoice === "ITEMISED" && (
            <>
              <label className="block"><span className={lbl}>Basic salary (AED)</span><input name="basic" type="number" min={0} step="0.01" className="input w-full" /></label>
              <label className="block"><span className={lbl}>Housing allowance</span><input name="housing" type="number" min={0} step="0.01" className="input w-full" /></label>
              <label className="block"><span className={lbl}>Food allowance</span><input name="food" type="number" min={0} step="0.01" className="input w-full" /></label>
              <label className="block"><span className={lbl}>Transport allowance</span><input name="transport" type="number" min={0} step="0.01" className="input w-full" /></label>
              <label className="block"><span className={lbl}>Other allowance</span><input name="other" type="number" min={0} step="0.01" className="input w-full" /></label>
            </>
          )}
        </Section>
      ) : (
        <p className="rounded-md border border-default px-4 py-3 text-sm text-muted">Pay is set by someone with payroll access, from the employee&rsquo;s page, after they are added.</p>
      )}

      {files.length > 0 && (
        <section className="card p-5">
          <label className="flex items-start gap-2 text-sm text-primary"><input type="checkbox" name="copyFiles" value="1" defaultChecked className="mt-0.5" /> Copy these {files.length} file{files.length === 1 ? "" : "s"} to the employee&rsquo;s documents</label>
          <ul className="mt-2 divide-y divide-[var(--border)] text-sm">
            {files.map((f) => <li key={f.id} className="flex justify-between gap-3 py-1.5"><span className="truncate text-secondary">{f.name}</span><span className="shrink-0 text-xs text-muted">{DOC_LABEL[f.docType] ?? f.docType}{f.expiry ? ` · expires ${f.expiry.split("-").reverse().join("-")}` : ""}</span></li>)}
          </ul>
        </section>
      )}

      {!ready && (
        <label className="flex items-start gap-2 rounded-md border border-[var(--warning-border)] bg-[var(--warning-soft)] px-4 py-3 text-sm text-primary">
          <input type="checkbox" name="earlyConfirm" value="1" className="mt-0.5" />
          <span>This candidate hasn&rsquo;t finished all their onboarding steps. I&rsquo;m adding them early on purpose. They will then show as joined.</span>
        </label>
      )}

      {state.warnings && state.warnings.length > 0 && dismissed !== state && (
        <SaveWarnings warnings={state.warnings} busy={pending} onDismiss={() => setDismissed(state)} onSaveAnyway={resend} />
      )}
      {state.error && <p role="alert" className="rounded-control border border-[var(--error-border)] bg-[var(--error-soft)] px-3 py-2 text-sm text-[var(--error)]">{state.error}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Adding…" : "Add to employees"}</button>
        <Link href={`/onboarding/${candidateId}`} className="text-sm text-muted hover:text-primary">Cancel</Link>
      </div>
    </form>
  );
}
