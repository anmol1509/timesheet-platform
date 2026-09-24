"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { getNavPages } from "@/app/(app)/nav-links";
import { cn } from "@/lib/cn";

type Link = { href: string; label: string; group: string };
type Msg = { role: "user" | "assistant"; content: string; links?: Link[]; error?: boolean };

const SUGGESTIONS = [
  "Where do I renew a visa?",
  "How do I raise a demand?",
  "Where can I check a worker in to a camp?",
  "Where are invoices generated?",
];

const GREETING: Msg = {
  role: "assistant",
  content: "Hi! Tell me what you want to do and I'll point you to the right page.",
};

/**
 * Floating navigation assistant. Sends the conversation plus the user's own
 * sidebar pages (getNavPages, already filtered by their module access) to
 * /api/assistant, which answers with a short reply and up to three page links.
 * Conversation lives in component state only — closing the tab clears it.
 */
export function NavAssistant({
  isAdmin,
  isSuperAdmin,
  allowedModules = null,
}: {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  allowedModules?: string[] | null;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pages = useMemo(
    () => getNavPages(isAdmin, isSuperAdmin, allowedModules).map(({ href, label, group }) => ({ href, label, group })),
    [isAdmin, isSuperAdmin, allowedModules]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The greeting is UI-only; the API wants the thread to open on the user.
          messages: next.filter((m) => m !== GREETING && !m.error).map(({ role, content }) => ({ role, content })),
          pages,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages([...next, { role: "assistant", content: data.answer || "I couldn't find a match.", links: data.links }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation assistant"
          className="fixed right-4 bottom-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white shadow-popover transition-transform hover:scale-105 sm:right-6 sm:bottom-6"
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="Navigation assistant"
          className="fixed inset-x-3 bottom-3 z-50 flex max-h-[min(34rem,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-overlay border border-default bg-surface shadow-popover sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
        >
          <header className="flex items-center gap-2 border-b border-default px-4 py-3">
            <Sparkles className="h-4 w-4 text-[var(--brand-primary)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-primary">Navigation assistant</p>
              <p className="text-xs text-muted">Ask where to find something</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-control p-1.5 text-muted hover:bg-surface-hover hover:text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex flex-col gap-1.5", m.role === "user" ? "items-end" : "items-start")}>
                <p
                  className={cn(
                    "max-w-[85%] rounded-card px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-[var(--brand-primary)] text-white"
                      : m.error
                        ? "bg-error-soft text-[var(--error)]"
                        : "bg-surface-subtle text-primary"
                  )}
                >
                  {m.content}
                </p>
                {m.links?.map((l) => (
                  <button
                    key={l.href}
                    type="button"
                    onClick={() => go(l.href)}
                    className="flex max-w-[85%] items-center gap-2 rounded-control border border-default bg-surface px-2.5 py-1.5 text-left text-sm text-primary hover:bg-surface-hover"
                  >
                    <span className="min-w-0 truncate">
                      {l.label} <span className="text-xs text-muted">· {l.group}</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary)]" />
                  </button>
                ))}
              </div>
            ))}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-default px-2.5 py-1 text-xs text-secondary hover:bg-surface-hover hover:text-primary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-default p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="e.g. where do I add a new worker?"
              aria-label="Ask the assistant"
              className="input flex-1"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="btn btn-primary">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
