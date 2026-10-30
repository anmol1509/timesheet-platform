"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { DatePicker } from "@/components/ui/DatePicker";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { MaskedInput } from "@/components/ui/MaskedInput";
import { ImageUpload } from "@/components/ImageUpload";
import { GAP_FIELDS, gapElsewhere } from "@/lib/letterGaps";
import type { IssuerOption } from "@/lib/employeeLetterIssuer";
import { fixLetterGapsAction, uploadLetterOneOffImageAction } from "./actions";
import { uploadLetterImageAction } from "../settings/company/actions";
import { uploadSupplierLetterImageAction } from "../suppliers/actions";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
export type OneOff = { id: string; url: string } | null;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  templateName: string;
  gaps: { key: string; label: string }[];
  issuer: IssuerOption;
  branchId: string;
  /** Whether this person may make an upload the company's default (company profile or supplier page). */
  canSaveDefault: boolean;
  oneOffSignature: OneOff;
  oneOffStamp: OneOff;
  /** A one-off was uploaded: use it on this letter. */
  onOneOff: (kind: "signature" | "stamp", img: NonNullable<OneOff>) => void;
  /** Something was saved (employee details, or a default image): reload the preview and the letterhead choices. */
  onSaved: (what: "details" | "image", kind?: "signature" | "stamp") => void;
};

/**
 * Everything the letter is missing, fixed without leaving the page. Employee details are saved to the employee's
 * record. A signature or stamp can be saved as the company default or used for this letter only.
 */
export function FixLetterDialog(p: Props) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [saveAs, setSaveAs] = useState<"default" | "once">(p.canSaveDefault ? "default" : "once");
  const fixable = p.gaps.filter((g) => GAP_FIELDS[g.key]);
  const elsewhere = p.gaps.filter((g) => !GAP_FIELDS[g.key]);
  const filled = Object.entries(values).filter(([, v]) => v.trim());
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const lab = "mb-1 block text-xs font-medium text-muted";

  function save() {
    setError(null);
    start(async () => {
      const res = await fixLetterGapsAction(p.employeeId, Object.fromEntries(filled));
      if (res.error) return setError(res.error);
      setValues({});
      p.onSaved("details");
      p.onOpenChange(false);
    });
  }

  function input(key: string) {
    const f = GAP_FIELDS[key];
    const v = values[key] ?? "";
    switch (f.input) {
      case "date": return <DatePicker value={v} onChange={(iso) => set(key, iso)} ariaLabel="Joining date" className="w-full" />;
      case "country": return <CountrySelect value={v} onChange={(c) => set(key, c)} placeholder="Select nationality…" />;
      case "passport": return <MaskedInput kind="passport" value={v} onChange={(e) => set(key, e.target.value)} className="input w-full" />;
      case "eid": return <MaskedInput kind="eid" value={v} onChange={(e) => set(key, e.target.value)} className="input w-full" placeholder="784-YYYY-NNNNNNN-C" />;
      case "iban": return <MaskedInput kind="iban" value={v} onChange={(e) => set(key, e.target.value)} className="input w-full" />;
      default: return <input value={v} onChange={(e) => set(key, e.target.value)} className="input w-full" />;
    }
  }

  // Where a default image goes: the company profile, or the visa/supplier company the letterhead belongs to.
  const defaultAction = p.issuer.supplierId ? uploadSupplierLetterImageAction : uploadLetterImageAction;
  const defaultFields = (kind: string): Record<string, string> => (p.issuer.supplierId ? { supplierId: p.issuer.supplierId, kind } : { branchId: p.branchId, kind });
  const imageRow = (kind: "signature" | "stamp", label: string, hint: string) => {
    const have = kind === "signature" ? p.issuer.signatureUrl : p.issuer.stampUrl;
    const once = kind === "signature" ? p.oneOffSignature : p.oneOffStamp;
    return (
      <div key={kind} className="border-t border-default py-3">
        <ImageUpload
          currentUrl={once?.url ?? have}
          fallback={<span className="text-xs text-subtle">{label}</span>}
          label={label}
          hint={hint}
          shape="square"
          format="image/png"
          maxPx={kind === "signature" ? 600 : 500}
          uploadAction={saveAs === "once"
            ? async (fd) => { const r = await uploadLetterOneOffImageAction(fd); if (r.id && r.url) p.onOneOff(kind, { id: r.id, url: r.url }); return r; }
            : async (fd) => { const r = await defaultAction(fd); if (!r?.error) p.onSaved("image", kind); return r; }}
          extraFields={saveAs === "once" ? {} : defaultFields(kind)}
        />
      </div>
    );
  };
  const needSignature = !p.issuer.signatureUrl;
  const needStamp = !p.issuer.stampUrl;

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent title="Fix missing details" description={`For ${p.employeeName} · ${p.templateName}. Details are saved to the employee's record, so the next letter has them too.`} className="max-w-xl">
        <div className="mt-3 space-y-1">
          {fixable.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Employee record · {fixable.length}</p>
              {fixable.map((g) => (
                <label key={g.key} className="block">
                  <span className={lab}>{g.label}</span>
                  {input(g.key)}
                </label>
              ))}
            </div>
          )}
          {elsewhere.length > 0 && (
            <div className="space-y-1.5 pt-3">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Added elsewhere · {elsewhere.length}</p>
              {elsewhere.map((g) => {
                const e = gapElsewhere(g.key);
                return (
                  <p key={g.key} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-primary">{g.label}</span>
                    <Link href={e.href(p.employeeId)} className="text-right text-xs font-medium text-brand hover:underline" target="_blank">{e.label} ↗</Link>
                  </p>
                );
              })}
            </div>
          )}
          {(needSignature || needStamp) && (
            <div className="pt-3">
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">Signature and stamp for {p.issuer.name}</p>
              <fieldset className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                <legend className="sr-only">Where to keep an upload</legend>
                {p.canSaveDefault && (
                  <label className="flex items-center gap-2"><input type="radio" name="saveas" checked={saveAs === "default"} onChange={() => setSaveAs("default")} />Save as the default</label>
                )}
                <label className="flex items-center gap-2"><input type="radio" name="saveas" checked={saveAs === "once"} onChange={() => setSaveAs("once")} />This letter only</label>
              </fieldset>
              <p className="mt-1 text-xs text-muted">{saveAs === "default" ? "Kept for every later letter. Each one still prints it only when ticked." : "Prints on this letter only. Nothing is changed on the company's profile."}</p>
              {needSignature && imageRow("signature", "Signature", "PNG on a plain or transparent background.")}
              {needStamp && imageRow("stamp", "Company stamp", "PNG of the stamp, ideally transparent.")}
            </div>
          )}
        </div>
        {error && <Alert className="mt-3">{error}</Alert>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => p.onOpenChange(false)}>Close</button>
          {fixable.length > 0 && (
            <Button size="btn" type="button" disabled={pending || filled.length === 0} onClick={save} loading={pending}>{`Save ${filled.length || ""} detail${filled.length === 1 ? "" : "s"} & update letter`.replace("  ", " ")}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
