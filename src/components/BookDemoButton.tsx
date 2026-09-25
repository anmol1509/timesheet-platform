"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const BRAND = "var(--brand-primary, #5645d4)";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Drop-in replacement for `<a href={demoHref}>` — renders the same trigger
 * (styling comes entirely from `className`) but opens a dialog collecting
 * name/email/phone/company instead of composing a mailto: link.
 */
export function BookDemoButton({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  /** Called alongside opening the dialog — e.g. to collapse a mobile menu. */
  onClick?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          onClick?.();
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open && <DemoDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function DemoDialog({ onClose }: { onClose: () => void }) {
  const titleId = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          email: form.get("email"),
          phone: form.get("phone"),
          company: form.get("company"),
        }),
      });
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => null);
        const message =
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "Something went wrong. Please try again.";
        throw new Error(message);
      }
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  }

  return createPortal(
    <div
      className="theme-force-light fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X size={18} />
        </button>

        {status === "success" ? (
          <div className="py-4 text-center">
            <h2 id={titleId} className="text-xl font-semibold text-slate-900">
              Thanks — we&rsquo;ll be in touch
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Someone from our team will reach out shortly to schedule your demo.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 rounded-full px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ background: BRAND }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 id={titleId} className="text-xl font-semibold text-slate-900">
              Book a demo
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Tell us a bit about you and we&rsquo;ll set up a time.
            </p>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Field label="Name" name="name" type="text" autoComplete="name" />
              <Field label="Email" name="email" type="email" autoComplete="email" />
              <Field label="Phone number" name="phone" type="tel" autoComplete="tel" />
              <Field label="Company name" name="company" type="text" autoComplete="organization" />
              {status === "error" && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded-full px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: BRAND }}
              >
                {status === "submitting" ? "Sending…" : "Submit"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete: string;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        className="w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[var(--brand-primary,#5645d4)] focus:ring-2 focus:ring-[var(--brand-primary,#5645d4)]/15"
      />
    </div>
  );
}
