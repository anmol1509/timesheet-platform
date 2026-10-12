"use client";

import { Info } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { GLOSSARY, type GlossaryKey } from "@/lib/payrollGlossary";

/** A small (i) that explains a payroll term in plain English on hover, focus or tap. */
export function Hint({ term, label, side = "top" }: { term?: GlossaryKey; label?: string; side?: "top" | "right" | "bottom" | "left" }) {
  const text = label ?? (term ? GLOSSARY[term] : "");
  if (!text) return null;
  return (
    <Tooltip label={text} side={side}>
      <button type="button" aria-label={text} className="ml-1 inline-flex align-middle text-subtle hover:text-secondary focus-visible:text-secondary" onClick={(e) => e.preventDefault()}>
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
    </Tooltip>
  );
}
