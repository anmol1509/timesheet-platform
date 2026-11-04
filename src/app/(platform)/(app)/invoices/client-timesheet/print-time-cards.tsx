"use client";

import { useState } from "react";
import Link from "next/link";
import { IdCard } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { RadioGroup } from "@/components/ui/RadioGroup";

export type TimeCardPrintInfo = { hasArtwork: boolean; canSeePay: boolean; shiftIn: string; shiftOut: string };

/**
 * Print the time cards (11.5 x 22 cm) for the workers shown or selected. Three ways to print: the whole card from the uploaded
 * artwork, only the values for the physical card, or a card drawn from the editable template.
 */
export function PrintTimeCards({ month, idNos, info, count }: { month: string; idNos: string[]; info: TimeCardPrintInfo; count: number }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<string>(info.hasArtwork ? "artwork" : "template");
  const [fill, setFill] = useState("header");
  const [inout, setInout] = useState("blank");
  const [paper, setPaper] = useState("card");
  const [pay, setPay] = useState(false);

  const href = `/api/timecards/pdf?${new URLSearchParams({ idNos: idNos.join(","), month, mode, fill, inout, paper, ...(pay && info.canSeePay ? { pay: "1" } : {}) }).toString()}`;
  const tooMany = idNos.length > 300;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" disabled={idNos.length === 0} className="btn btn-secondary btn-sm inline-flex items-center gap-1.5">
          <IdCard className="h-3.5 w-3.5" aria-hidden /> Print time cards ({count})
        </button>
      </DialogTrigger>
      <DialogContent icon={<IdCard className="h-[18px] w-[18px]" />} title="Print time cards" description={`${count} worker${count === 1 ? "" : "s"} · ${month} · one card per page, 11.5 × 22 cm`} className="max-w-xl">
        <div className="mt-4 space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">How to print</p>
            <RadioGroup
              value={mode}
              onChange={setMode}
              options={[
                { value: "artwork", label: "The whole card, from each company's uploaded card (plain paper)" },
                { value: "overprint", label: "Only the writing, to print on top of the physical card" },
                { value: "template", label: "The whole card drawn by the app from the template (plain paper)" },
              ]}
            />
            <p className="mt-2 text-xs text-muted">Each worker&apos;s card carries their own company&apos;s name and logo. For the first option, upload each company&apos;s blank card under its Documents → Time card.</p>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">What goes on it</p>
            <RadioGroup
              value={fill}
              onChange={setFill}
              options={[
                { value: "header", label: "The worker's details only (the foreman writes the days by hand)" },
                { value: "full", label: "The month's hours filled in from the timesheet or attendance" },
              ]}
            />
            {fill === "full" && (
              <div className="mt-3 space-y-2 border-l-2 border-default pl-3">
                <RadioGroup
                  value={inout}
                  onChange={setInout}
                  options={[
                    { value: "blank", label: "Leave IN and OUT blank" },
                    { value: "standard", label: `Print the standard shift (${info.shiftIn} to ${info.shiftOut}) on days worked` },
                  ]}
                />
                {info.canSeePay && (
                  <label className="flex items-center gap-2 text-sm text-secondary">
                    <input type="checkbox" checked={pay} onChange={(e) => setPay(e.target.checked)} /> Include the wage and the amounts from payroll
                  </label>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Paper</p>
            <RadioGroup
              value={paper}
              onChange={setPaper}
              options={[
                { value: "card", label: "Card size (11.5 × 22 cm): for a printer that takes it" },
                { value: "a4", label: "An A4 sheet with the card's place marked in the corners" },
              ]}
            />
          </div>

          {tooMany && <p className="text-xs text-[var(--error)]">That is more than 300 workers. Select fewer.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-4">
            <Link href="/settings/company" className="text-xs font-medium text-[var(--brand-primary)] hover:underline">Edit the template or upload your card</Link>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-disabled={tooMany}
              className={`btn btn-primary ${tooMany ? "pointer-events-none opacity-50" : ""}`}
              onClick={() => setOpen(false)}
            >
              Open the PDF
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
