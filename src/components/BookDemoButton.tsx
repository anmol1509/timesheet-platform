"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import * as Popover from "@radix-ui/react-popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "cmdk";
import { ArrowRight, Building2, CalendarCheck, Check, ChevronDown, Cog, Lock, Mail, MessageSquareText, Phone, User, Users, X, type LucideIcon } from "lucide-react";
import "flag-icons/css/flag-icons.min.css";
import { COUNTRIES } from "@/lib/countries";
import { BRAND_LOGO_URL, BRAND_LOGO_ASPECT } from "@/lib/brand-urls";
import { Alert } from "@/components/Alert";

const BRAND = "var(--brand-primary, #5645d4)";
const SUBMIT_GRADIENT = "linear-gradient(90deg, #5b3df0, #4129d6)";

type Status = "idle" | "submitting" | "success" | "error";

const POINTS: { icon: LucideIcon; title: string; text: string; tint: string }[] = [
  { icon: Cog, title: "Get a personalized walkthrough", text: "Tailored to your business needs", tint: "text-[#4f46e5]" },
  { icon: Users, title: "Explore key features", text: "Workforce, compliance, projects & more", tint: "text-[#4f46e5]" },
  { icon: MessageSquareText, title: "Ask questions", text: "Get all your queries answered", tint: "text-[#7c3aed]" },
  { icon: CalendarCheck, title: "Find the right plan", text: "Based on your team size and goals", tint: "text-[#4f46e5]" },
];

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
  // UAE first: that is where nearly every visitor is.
  const [country, setCountry] = useState("ae");
  const [number, setNumber] = useState("");
  const dial = COUNTRIES.find((c) => c.code === country)?.dial ?? "+971";

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
    const digits = number.replace(/\D/g, "").replace(/^0+/, "");
    if (digits.length < 6) {
      setStatus("error");
      setError("Enter your phone number, including the area or mobile code.");
      return;
    }
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
          phone: `${dial}${digits}`,
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
      className="theme-force-light fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="absolute inset-0 bg-[#0b0b2a]/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className="relative my-auto grid w-full max-w-[940px] overflow-hidden rounded-[22px] bg-white shadow-2xl grid-cols-[minmax(0,1fr)] md:grid-cols-[0.95fr_1fr]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition-colors hover:bg-slate-200"
        >
          <X size={18} />
        </button>

        <BrandPanel />

        <div className="px-6 py-8 sm:px-10 sm:py-10">
          {status === "success" ? (
            <div className="flex min-h-[26rem] flex-col items-center justify-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check size={28} /></span>
              <h2 id={titleId} className="mt-5 text-2xl font-bold text-slate-900">Thanks: we&rsquo;ll be in touch</h2>
              <p className="mt-2 max-w-xs text-sm text-slate-500">Someone from our team will reach out shortly to schedule your demo.</p>
              <button type="button" onClick={onClose} className="mt-6 rounded-full px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90" style={{ background: SUBMIT_GRADIENT }}>Close</button>
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold tracking-[0.14em] text-slate-500 uppercase">Book a demo</p>
              <h2 id={titleId} className="mt-2 text-[1.7rem] leading-tight font-extrabold tracking-tight text-slate-900">Tell us a bit about you</h2>
              <p className="mt-2 text-[0.95rem] leading-relaxed text-slate-500">Our team will get in touch to schedule a personalized demo at your convenience.</p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <Field label="Name" name="name" type="text" autoComplete="name" placeholder="Your full name" icon={User} />
                <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@company.com" icon={Mail} />
                <PhoneRow country={country} onCountry={setCountry} dial={dial} number={number} onNumber={setNumber} />
                <Field label="Company name" name="company" type="text" autoComplete="organization" placeholder="Your company name" icon={Building2} />
                {status === "error" && <Alert>{error}</Alert>}
                <button
                  type="submit"
                  disabled={status === "submitting"}
                  className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 text-[0.95rem] font-semibold text-white shadow-[0_10px_24px_-10px_rgba(79,53,232,0.7)] transition-opacity hover:opacity-95 disabled:opacity-60"
                  style={{ background: SUBMIT_GRADIENT }}
                >
                  {status === "submitting" ? "Sending…" : <>Submit <ArrowRight size={18} aria-hidden /></>}
                </button>
                <p className="flex items-start justify-center gap-2.5 px-2 text-xs leading-relaxed text-slate-500">
                  <Lock size={15} className="mt-0.5 shrink-0" aria-hidden />
                  <span>We respect your privacy. Your information will only be used to schedule the demo.</span>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The left half: logo, headline, what the demo covers, and a soft wave along the bottom. */
function BrandPanel() {
  return (
    <div
      className="relative hidden overflow-hidden px-10 pt-10 pb-8 md:block"
      style={{ background: "radial-gradient(60% 45% at 0% 58%, #fff6d8 0%, rgba(255,246,216,0) 70%), radial-gradient(70% 50% at 100% 0%, #9ec7ff 0%, rgba(158,199,255,0) 70%), linear-gradient(150deg, #f7f3ff 0%, #e2e5ff 55%, #cfe0ff 100%)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- inlined brand asset */}
      <img src={BRAND_LOGO_URL} alt="ManpowerSync" width={Math.round(36 * BRAND_LOGO_ASPECT)} height={36} className="h-9 w-auto" />
      <h2 className="mt-16 text-[2.7rem] leading-none font-extrabold tracking-tight text-slate-900">
        Book a <span style={{ color: "#4a2fe0" }}>demo</span>
      </h2>
      <p className="mt-3 max-w-[18rem] text-[1.05rem] leading-snug text-slate-600">See how ManpowerSync can simplify your workforce operations.</p>
      <ul className="mt-9 space-y-5">
        {POINTS.map((p) => (
          <li key={p.title} className="flex items-center gap-4">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/85 shadow-[0_8px_20px_-10px_rgba(79,70,229,0.5)] ${p.tint}`}><p.icon size={22} aria-hidden /></span>
            <span>
              <span className="block text-[0.95rem] font-semibold text-slate-900">{p.title}</span>
              <span className="block text-sm text-slate-500">{p.text}</span>
            </span>
          </li>
        ))}
      </ul>
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-44 w-full" viewBox="0 0 470 176" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="wave-a" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#6d4bff" /><stop offset="0.55" stopColor="#a58bff" /><stop offset="1" stopColor="#d9ccff" /></linearGradient>
          <linearGradient id="wave-b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#8aa4ff" /><stop offset="1" stopColor="#3b82f6" /></linearGradient>
        </defs>
        <path d="M0 150 C 70 112, 130 120, 200 150 S 340 150, 470 70 L 470 176 L 0 176 Z" fill="url(#wave-a)" opacity="0.9" />
        <path d="M150 176 C 230 120, 300 100, 380 120 S 450 150, 470 130 L 470 176 Z" fill="url(#wave-b)" opacity="0.85" />
        <path d="M0 150 C 70 112, 130 120, 200 150 S 340 150, 470 70" fill="none" stroke="#fff" strokeOpacity="0.6" />
      </svg>
    </div>
  );
}

const FIELD_BOX = "flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition focus-within:border-[#5b3df0] focus-within:ring-2 focus-within:ring-[#5b3df0]/15";
const FIELD_INPUT = "h-[3.1rem] min-w-0 flex-1 bg-transparent text-[0.95rem] text-slate-900 outline-none placeholder:text-slate-400";

function Field({ label, name, type, autoComplete, placeholder, icon: Icon }: { label: string; name: string; type: string; autoComplete: string; placeholder: string; icon: LucideIcon }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-800">{label}</label>
      <div className={FIELD_BOX}>
        <Icon size={19} className="shrink-0 text-slate-500" aria-hidden />
        <input id={id} name={name} type={type} required autoComplete={autoComplete} placeholder={placeholder} className={FIELD_INPUT} />
      </div>
    </div>
  );
}

/** Phone number with a searchable country-code list, each country shown with its flag. Starts on the UAE. */
function PhoneRow({ country, onCountry, dial, number, onNumber }: { country: string; onCountry: (code: string) => void; dial: string; number: string; onNumber: (v: string) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  // UAE at the top of the list, then everyone else alphabetically.
  const list = useMemo(() => [...COUNTRIES].sort((a, b) => (a.code === "ae" ? -1 : b.code === "ae" ? 1 : a.name.localeCompare(b.name))), []);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-800">Phone number</label>
      <div className={FIELD_BOX}>
        <Phone size={19} className="shrink-0 text-slate-500" aria-hidden />
        <Popover.Root open={open} onOpenChange={setOpen}>
          <Popover.Trigger asChild>
            <button type="button" aria-label={`Country code, ${dial} selected`} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1.5 text-sm text-slate-700 transition hover:bg-slate-200">
              <span className={`fi fi-${country} rounded-[2px]`} aria-hidden />
              <ChevronDown size={14} aria-hidden />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content align="start" sideOffset={8} className="theme-force-light z-[120] w-[19rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <Command loop filter={(value, search) => (value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
                <CommandInput autoFocus placeholder="Search country or code…" className="w-full border-b border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400" />
                <CommandList className="max-h-64 overflow-y-auto p-1">
                  <CommandEmpty className="px-3 py-6 text-center text-sm text-slate-500">No matching country.</CommandEmpty>
                  {list.map((c) => (
                    <CommandItem key={c.code} value={`${c.name} ${c.dial} ${c.code}`} onSelect={() => { onCountry(c.code); setOpen(false); }} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-slate-800 data-[selected=true]:bg-slate-100">
                      <span className={`fi fi-${c.code} rounded-[2px]`} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="tabular text-slate-500">{c.dial}</span>
                      {c.code === country && <Check size={15} className="text-[#5b3df0]" aria-hidden />}
                    </CommandItem>
                  ))}
                </CommandList>
              </Command>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <span className="tabular shrink-0 text-[0.95rem] text-slate-700">{dial}</span>
        <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" required value={number} onChange={(e) => onNumber(e.target.value.replace(/[^\d\s-]/g, ""))} placeholder="50 123 4567" className={FIELD_INPUT} />
      </div>
    </div>
  );
}
