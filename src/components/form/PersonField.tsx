"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Phone } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/Dialog";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { cn } from "@/lib/cn";

/**
 * A person the record refers to (sales executive, coordinator, manager...).
 * The name sits in the form like any other field; phone (required once a name
 * is given) and email live behind a chip that opens a small dialog, so adding
 * contact details doesn't lengthen the form.
 *
 * Submits `name`, `${name}Phone` and `${name}Email` as ordinary form fields.
 * The name input is marked invalid while the phone is missing, so the browser
 * blocks the submit and points at it.
 */
export function PersonField({
  name,
  label,
  defaultName,
  defaultPhone,
  defaultEmail,
}: {
  name: string;
  label: string;
  defaultName?: string | null;
  defaultPhone?: string | null;
  defaultEmail?: string | null;
}) {
  const [person, setPerson] = useState(defaultName ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [open, setOpen] = useState(false);
  const [draftPhone, setDraftPhone] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);

  const digits = phone.replace(/\D/g, "");
  const missingPhone = person.trim() !== "" && digits.length < 7;

  useEffect(() => {
    nameRef.current?.setCustomValidity(missingPhone ? `Add a phone number for ${label.toLowerCase()}.` : "");
  }, [missingPhone, label]);

  function onOpenChange(next: boolean) {
    if (next) {
      setDraftPhone(phone);
      setDraftEmail(email);
    }
    setOpen(next);
  }

  const draftDigits = draftPhone.replace(/\D/g, "");
  const emailBad = draftEmail.trim() !== "" && !/^\S+@\S+\.\S+$/.test(draftEmail.trim());
  const canSave = draftDigits.length >= 7 && !emailBad;

  return (
    <div>
      <label className="field-label" htmlFor={`${name}-name`}>{label}</label>
      <div className="flex items-stretch gap-2">
        <input
          ref={nameRef}
          id={`${name}-name`}
          name={name}
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          className="input min-w-0 flex-1"
          autoComplete="off"
        />
        <input type="hidden" name={`${name}Phone`} value={person.trim() ? phone : ""} />
        <input type="hidden" name={`${name}Email`} value={person.trim() ? email : ""} />
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogTrigger asChild>
            <button
              type="button"
              disabled={!person.trim()}
              title={person.trim() ? "Contact details" : `Enter the ${label.toLowerCase()}'s name first`}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium transition disabled:opacity-40",
                missingPhone
                  ? "border-[var(--error-border)] bg-[var(--error-soft)] text-[var(--error)]"
                  : "border-default bg-surface text-secondary hover:bg-surface-hover"
              )}
            >
              {missingPhone || !person.trim() ? (
                <>
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {person.trim() ? "Add phone" : "Contact"}
                </>
              ) : (
                <>
                  <Phone className="h-3.5 w-3.5 text-[var(--success)]" aria-hidden />
                  <span className="tabular max-w-[120px] truncate">{phone}</span>
                  {email && <Mail className="h-3.5 w-3.5 text-muted" aria-label="Has email" />}
                </>
              )}
            </button>
          </DialogTrigger>
          <DialogContent title={`${label} — contact`} description={person.trim() || undefined} className="max-w-sm">
            <div className="mt-4 space-y-4">
              <div>
                <label className="field-label" htmlFor={`${name}-phone`}>
                  Phone <span className="text-[var(--error)]">*</span>
                </label>
                <PhoneInput id={`${name}-phone`} value={draftPhone} onChange={setDraftPhone} />
              </div>
              <div>
                <label className="field-label" htmlFor={`${name}-email`}>Email</label>
                <input
                  id={`${name}-email`}
                  type="email"
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  className="input w-full"
                  placeholder="name@company.com"
                />
                {emailBad && <p className="field-error mt-1">Enter a valid email address.</p>}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <button type="button" className="btn btn-secondary">Cancel</button>
              </DialogClose>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canSave}
                onClick={() => {
                  setPhone(draftPhone);
                  setEmail(draftEmail.trim());
                  setOpen(false);
                }}
              >
                Save contact
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
