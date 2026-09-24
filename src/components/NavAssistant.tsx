"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import {
  ArrowRight,
  ArrowUp,
  BarChart3,
  ListChecks,
  RotateCcw,
  Search,
  Sparkles,
  UserSearch,
  X,
  type LucideIcon,
} from "lucide-react";
import { getNavPages } from "@/app/(app)/nav-links";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";

type Link = { href: string; label: string; group: string };
type Msg = { role: "user" | "assistant"; content: string; links?: Link[]; error?: boolean };

const SUGGESTIONS: { text: string; icon: LucideIcon }[] = [
  { text: "Where do I renew a visa?", icon: Search },
  { text: "How do I get workers onto a project?", icon: ListChecks },
  { text: "Open the profile for a worker", icon: UserSearch },
  { text: "How many workers are on the bench?", icon: BarChart3 },
];

const GRADIENT = "linear-gradient(135deg, var(--brand-primary), #7c3aed)";

function Avatar({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-white shadow-sm",
        size === "sm" ? "h-6 w-6" : "h-9 w-9"
      )}
      style={{ background: GRADIENT }}
      aria-hidden
    >
      <Sparkles className={size === "sm" ? "h-3 w-3" : "h-4.5 w-4.5"} />
    </span>
  );
}

function TypingDots() {
  return (
    <div className="flex items-end gap-2">
      <Avatar size="sm" />
      <div className="flex items-center gap-1 rounded-card rounded-bl-sm bg-surface-subtle px-3 py-3" aria-label="My Assistant is typing">
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-muted)]"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * "My Assistant" — floating chat for finding pages, records and quick answers.
 * Sends the conversation plus the user's own sidebar pages (getNavPages, already
 * filtered by their module access) to /api/assistant. The conversation lives in
 * component state only — closing the tab clears it.
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
  const [messages, setMessages] = useState<Msg[]>([]);
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
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, busy]);

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
          messages: next.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
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

  const empty = messages.length === 0;

  return (
    <>
      <AnimatePresence>
        {!open && (
          <m.button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Open My Assistant"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            transition={SPRING}
            className="group fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full py-3 pr-3 pl-3 text-white shadow-popover sm:right-6 sm:bottom-6"
            style={{ background: GRADIENT }}
          >
            <span className="absolute inset-0 -z-10 animate-ping rounded-full opacity-20 [animation-duration:2.6s]" style={{ background: GRADIENT }} aria-hidden />
            <Sparkles className="h-5 w-5" />
            <span className="hidden max-w-0 overflow-hidden text-sm font-medium whitespace-nowrap transition-all duration-200 group-hover:max-w-32 group-hover:pr-1 sm:inline">
              My Assistant
            </span>
          </m.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <m.section
            role="dialog"
            aria-label="My Assistant"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={SPRING}
            style={{ transformOrigin: "bottom right" }}
            className="fixed inset-x-3 bottom-3 z-50 flex h-[min(36rem,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-overlay border border-default bg-surface shadow-popover sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[24rem]"
          >
            <header className="relative flex items-center gap-3 px-4 py-3.5 text-white" style={{ background: GRADIENT }}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                <Sparkles className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-tight font-semibold">My Assistant</p>
                <p className="flex items-center gap-1.5 text-xs text-white/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden /> Ready to help
                </p>
              </div>
              {!empty && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  aria-label="Start a new chat"
                  title="New chat"
                  className="rounded-control p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close My Assistant"
                className="rounded-control p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto bg-canvas px-4 py-4" aria-live="polite">
              {empty && (
                <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <p className="text-lg font-semibold text-primary">Hi, how can I help?</p>
                    <p className="text-sm text-secondary">
                      Ask where something is, how a task works, or look up a worker, project or client.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {SUGGESTIONS.map(({ text, icon: Icon }, i) => (
                      <m.button
                        key={text}
                        type="button"
                        onClick={() => send(text)}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * i + 0.1 }}
                        className="group/s flex items-center gap-3 rounded-card border border-default bg-surface px-3 py-2.5 text-left text-sm text-primary transition-all hover:-translate-y-px hover:border-[var(--brand-primary)] hover:shadow-sm"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-brand-soft text-[var(--brand-primary)]">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">{text}</span>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted opacity-0 transition-opacity group-hover/s:opacity-100" />
                      </m.button>
                    ))}
                  </div>
                </m.div>
              )}

              {messages.map((msg, i) => (
                <m.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={cn("flex flex-col gap-2", msg.role === "user" ? "items-end" : "items-start")}
                >
                  <div className={cn("flex max-w-[88%] items-end gap-2", msg.role === "user" && "flex-row-reverse")}>
                    {msg.role === "assistant" && <Avatar size="sm" />}
                    <p
                      className={cn(
                        "rounded-card px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap",
                        msg.role === "user"
                          ? "rounded-br-sm text-white"
                          : msg.error
                            ? "rounded-bl-sm bg-error-soft text-[var(--error)]"
                            : "rounded-bl-sm border border-default bg-surface text-primary"
                      )}
                      style={msg.role === "user" ? { background: GRADIENT } : undefined}
                    >
                      {msg.content}
                    </p>
                  </div>
                  {msg.links && msg.links.length > 0 && (
                    <div className="flex w-full max-w-[88%] flex-col gap-1.5 pl-8">
                      {msg.links.map((l) => (
                        <button
                          key={l.href}
                          type="button"
                          onClick={() => go(l.href)}
                          className="group/l flex items-center gap-2.5 rounded-card border border-default bg-surface px-3 py-2 text-left transition-all hover:-translate-y-px hover:border-[var(--brand-primary)] hover:shadow-sm"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-primary">{l.label}</span>
                            <span className="block truncate text-xs text-muted">{l.group}</span>
                          </span>
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[var(--brand-primary)] transition-transform group-hover/l:translate-x-0.5">
                            <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </m.div>
              ))}

              {busy && <TypingDots />}
              <div ref={endRef} />
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-default bg-surface p-3"
            >
              <div className="flex items-center gap-2 rounded-card border border-default bg-canvas py-1 pr-1 pl-3 transition-colors focus-within:border-[var(--brand-primary)]">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  maxLength={500}
                  placeholder="Ask My Assistant…"
                  aria-label="Ask My Assistant"
                  className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-primary outline-none placeholder:text-muted"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control text-white transition-opacity disabled:opacity-40"
                  style={{ background: GRADIENT }}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </form>
          </m.section>
        )}
      </AnimatePresence>
    </>
  );
}
