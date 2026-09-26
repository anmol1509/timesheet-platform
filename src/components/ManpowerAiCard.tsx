"use client";

import { useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";

const GRADIENT = "linear-gradient(135deg, var(--brand-primary), #7c3aed)";
const CHIPS = ["Who is available for Project X?", "Which visas expire this month?", "Show workers on bench"];

function ask(text: string) {
  window.dispatchEvent(new CustomEvent("open-my-assistant", { detail: { text } }));
}

/** A docked preview of the floating "My Assistant" chat — opens the same panel. */
export function ManpowerAiCard() {
  const [value, setValue] = useState("");
  return (
    <section className="card flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 text-white" style={{ background: GRADIENT }}>
        <Sparkles className="h-4 w-4" aria-hidden />
        <span className="text-sm font-semibold">Assistant AI</span>
        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide">Beta</span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-sm text-secondary">Hi! I&apos;m your AI assistant. What can I help you with today?</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) ask(value.trim());
            setValue("");
          }}
          className="flex items-center gap-2 rounded-card border border-default bg-canvas py-1 pr-1 pl-3"
        >
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask anything…"
            aria-label="Ask Assistant AI"
            className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-primary outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            aria-label="Send"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-control text-white"
            style={{ background: GRADIENT }}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => ask(c)}
              className="rounded-full border border-default bg-surface-subtle px-2.5 py-1 text-xs text-secondary transition hover:border-strong hover:text-primary"
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
