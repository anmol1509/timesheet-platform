"use client";

import { CopyButton } from "@/components/ui/CopyButton";
import Link from "next/link";
import { useActionState, useState } from "react";
import { createCustomerAction, registerExistingAction, type OwnerState } from "../actions";
import { creditsValueAed } from "@/lib/owner";

import { Button } from "@/components/ui/Button";
const initial: OwnerState = { error: null };
const L = "block text-xs text-muted";
const I = "input mt-1 h-9 w-full text-sm";

function CopyLink({ link }: { link: string }) {
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={link} className="input h-9 min-w-0 flex-1 text-xs" onFocus={(e) => e.currentTarget.select()} aria-label="One-time sign-in link" />
      <CopyButton text={link} />
    </div>
  );
}

export function NewCustomerForm({ templates, defaultTemplate }: { templates: { id: string; code: string; name: string }[]; defaultTemplate: string }) {
  const [state, action, pending] = useActionState(createCustomerAction, initial);
  const [hosting, setHosting] = useState<"SHARED" | "DEDICATED">("SHARED");
  const [credits, setCredits] = useState("2500");
  const [rate, setRate] = useState("0.01");

  if (state.ok) {
    return (
      <section className="card space-y-4 p-6">
        <h1 className="text-lg font-semibold text-primary">Customer added</h1>
        <p className="text-sm text-secondary">Their workspace is set up and their first administrator has no password yet. Send them this link; it lets them choose one and works once.</p>
        {state.inviteLink && <CopyLink link={state.inviteLink} />}
        {state.inviteExpires && <p className="text-xs text-muted">The link works until {new Date(state.inviteExpires).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. If it runs out, they can use Forgot password on the sign-in page.</p>}
        <div className="flex gap-3"><Link href={`/owner/${state.customerId}`} className="btn btn-primary">Open the customer</Link><Link href="/owner" className="btn btn-secondary">Back to customers</Link></div>
      </section>
    );
  }
  return (
    <form action={action} className="space-y-6">
      <div><h1 className="text-lg font-semibold text-primary">Add a customer</h1><p className="text-sm text-muted">Sets up their workspace and their first administrator in one go.</p></div>

      <section className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-primary">Company</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={L}>Company name<input name="name" required className={I} placeholder="RKG Technical Services LLC" /></label>
          <label className={L}>Code (2 to 10 capitals or numbers)<input name="code" required className={`${I} uppercase`} placeholder="RKG" maxLength={10} /></label>
          <label className={L}>Contact person<input name="contactName" className={I} /></label>
          <label className={L}>Contact email (also their first administrator)<input name="contactEmail" type="email" required className={I} /></label>
          <label className={L}>Phone<input name="contactPhone" className={I} /></label>
          <label className={L}>Address<input name="address" className={I} /></label>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-primary">Where their data lives</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {([["SHARED", "On this platform", "A fenced company space in the main database. Quick to set up."], ["DEDICATED", "Their own database and deployment", "Separate database and app. The deployment must exist already; its address is needed below."]] as const).map(([v, t, d]) => (
            <label key={v} className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${hosting === v ? "border-[var(--brand-primary)] bg-brand-soft/40" : "border-default"}`}>
              <input type="radio" name="hosting" value={v} checked={hosting === v} onChange={() => setHosting(v)} className="mt-1" />
              <span><span className="block font-medium text-primary">{t}</span><span className="text-xs text-muted">{d}</span></span>
            </label>
          ))}
        </div>
        {hosting === "DEDICATED" && (
          <div className="grid gap-4 sm:grid-cols-3">
            <label className={`${L} sm:col-span-3`}>Their deployment address<input name="appUrl" className={I} placeholder="https://rkg-manpowersync.vercel.app" /></label>
            <label className={L}>Database project reference (optional)<input name="supabaseRef" className={I} /></label>
            <label className={L}>Vercel project (optional)<input name="vercelProject" className={I} /></label>
          </div>
        )}
        <label className={L}>Start them with the dropdowns and letter templates of<select name="templateBranchId" defaultValue={defaultTemplate} className={I}><option value="">Nothing, start empty</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.code})</option>)}</select></label>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold text-primary">Plan and AI credits</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={L}>Plan<input name="plan" defaultValue="Standard" className={I} /></label>
          <label className={L}>Price in AED<input name="planPriceAed" defaultValue="0" inputMode="decimal" className={I} /></label>
          <label className={L}>Billed<select name="billingCycle" className={I}><option value="MONTHLY">Monthly</option><option value="YEARLY">Yearly</option></select></label>
          <label className={L}>AI credits a month<input name="credits" value={credits} onChange={(e) => setCredits(e.target.value)} inputMode="numeric" className={I} /></label>
          <label className={L}>One credit is worth, in AED<input name="aiRateAed" value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" className={I} /></label>
          <label className={L}>Status<select name="status" className={I}><option value="TRIAL">Trial</option><option value="ACTIVE">Active</option></select></label>
        </div>
        <p className="text-xs text-muted">{Number(credits || 0).toLocaleString("en-US")} credits = AED {creditsValueAed(Number(credits || 0), Number(rate || 0)).toLocaleString("en-US", { minimumFractionDigits: 2 })}. Only you see this value. The customer sees credits and nothing else.</p>
        <label className={L}>Notes<textarea name="notes" rows={2} className="input mt-1 w-full text-sm" /></label>
      </section>

      {state.error && <p role="alert" className="rounded-lg border border-[var(--error-border)] bg-[var(--error-soft)] px-4 py-3 text-sm text-[var(--error)]">{state.error}</p>}
      <Button size="btn" type="submit" disabled={pending} loading={pending}>Add customer</Button>
    </form>
  );
}

export function RegisterExistingForm({ branches }: { branches: { id: string; code: string; name: string }[] }) {
  const [state, action, pending] = useActionState(registerExistingAction, initial);
  return (
    <form action={action} className="card space-y-3 p-5">
      <div><h2 className="text-sm font-semibold text-primary">Or add a company that is already on the platform</h2><p className="text-xs text-muted">For customers set up before this dashboard existed. Nothing in their data changes.</p></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={L}>Company<select name="branchId" className={I}>{branches.map((b) => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}</select></label>
        <label className={L}>Contact person<input name="contactName" className={I} /></label>
        <label className={L}>Contact email<input name="contactEmail" type="email" required className={I} /></label>
      </div>
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="btn" type="submit" disabled={pending} loading={pending}>Add to the list</Button>
        {state.error && <p role="alert" className="text-xs text-[var(--error)]">{state.error}</p>}
        {state.ok && <p className="text-xs text-[var(--success)]">Added. <Link href={`/owner/${state.customerId}`} className="underline">Open it</Link></p>}
      </div>
    </form>
  );
}
