"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, m } from "motion/react";
import {
  ArrowRight,
  ArrowUp,
  BarChart3,
  Download,
  Check,
  Globe,
  LifeBuoy,
  ListChecks,
  Maximize2,
  Minimize2,
  RotateCcw,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserSearch,
  X,
  type LucideIcon,
} from "lucide-react";
import { getNavPages } from "@/app/(platform)/(app)/nav-links";
import { cn } from "@/lib/cn";
import { SPRING } from "@/lib/motion";
import { submitSupportTicketAction } from "@/app/(platform)/(app)/support/actions";
import { LANGUAGE_OPTIONS, isAssistantLang, stringsFor, type AssistantLang } from "@/lib/assistantI18n";

type Link = { href: string; label: string; group: string };
type Table = { title: string; columns: string[]; rows: string[][]; total: number };
type Msg = {
  role: "user" | "assistant"; content: string; links?: Link[]; table?: Table; error?: boolean;
  /** The assistant could not resolve it: offer to send it to support. */
  needsSupport?: boolean;
  rating?: "UP" | "DOWN";
  support?: "sending" | "sent";
  /** How long the answer took, in seconds. */
  secs?: number;
};

const SUGGESTION_ICONS: LucideIcon[] = [Search, ListChecks, UserSearch, BarChart3];

const GRADIENT = "linear-gradient(135deg, var(--brand-primary), #8b5cf6)";
const GLASS = "bg-[color-mix(in_srgb,var(--surface)_84%,transparent)] backdrop-blur-2xl backdrop-saturate-150";

/** The assistant's mark: a slowly turning gradient with a soft highlight. */
function Orb({ size = 32, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <span
      className="relative inline-block shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size, boxShadow: glow ? "0 6px 20px rgba(120,90,240,.45)" : undefined }}
      aria-hidden
    >
      <span className="absolute inset-0 motion-safe:animate-[orb-spin_14s_linear_infinite]" style={{ background: "conic-gradient(from 210deg,#6d5df6,#c06cf3,#4fa8ff,#6d5df6)" }} />
      <span className="absolute inset-[22%] rounded-full" style={{ background: "radial-gradient(circle at 35% 30%,#fff,rgba(255,255,255,.35) 55%,transparent 70%)" }} />
    </span>
  );
}

function Thinking({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-muted" aria-label={label}>
      <Orb size={20} />
      <span className="motion-safe:animate-pulse">{label}</span>
    </div>
  );
}

/** Bold text, paragraphs and lists from the model's plain-text answer, without letting it inject any markup. */
function RichText({ text }: { text: string }) {
  const inline = (line: string) =>
    line.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i} className="font-semibold text-primary">{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>
    );
  const blocks: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(
      <Tag key={blocks.length} className={cn("space-y-1 pl-5", list.ordered ? "list-decimal" : "list-disc")}>
        {list.items.map((it, i) => <li key={i} className="pl-1 marker:text-subtle">{inline(it)}</li>)}
      </Tag>
    );
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const num = line.match(/^\d+[.)]\s+(.*)$/);
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (num || bullet) {
      const ordered = !!num;
      if (list && list.ordered !== ordered) flush();
      list = list ?? { ordered, items: [] };
      list.items.push((num ?? bullet)![1]);
    } else {
      flush();
      if (line) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flush();
  return <div className="space-y-2.5 text-[14.5px] leading-relaxed text-secondary [&_strong]:text-primary" dir="auto">{blocks}</div>;
}

/** A table the assistant looked up, with the rows exactly as the database returned them. */
function ResultTable({ table, downloadLabel, showing }: { table: Table; downloadLabel: string; showing: string | null }) {
  function download() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [table.columns, ...table.rows].map((r) => r.map(esc).join(",")).join("\r\n");
    // The byte-order mark makes Excel read Hindi, Urdu and Nepali names correctly.
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${table.title.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 40) || "table"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="w-full max-w-full overflow-hidden rounded-2xl border border-default bg-surface shadow-[0_8px_24px_-12px_rgba(60,40,150,.25)]" dir="ltr">
      <p className="border-b border-default px-4 py-2.5 text-[13px] font-semibold text-primary" dir="auto">{table.title}</p>
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-surface-subtle text-left text-[11px] tracking-wide text-muted uppercase">
            <tr>{table.columns.map((c) => <th key={c} className="px-3 py-2 font-semibold whitespace-nowrap">{c}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {table.rows.map((r, i) => (
              <tr key={i} className="transition-colors hover:bg-surface-hover">
                {r.map((v, j) => (
                  <td key={j} className={cn("px-3 py-2 whitespace-nowrap", j === 0 ? "font-medium text-primary" : "text-secondary")} dir="auto">{v}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-default bg-surface-subtle/60 px-4 py-2">
        <span className="text-[11px] text-muted" dir="auto">{showing ?? ""}</span>
        <button type="button" onClick={download} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
          <Download className="h-3 w-3" aria-hidden /> {downloadLabel}
        </button>
      </div>
    </div>
  );
}

/** Text of an error banner currently showing on the page (not the assistant's own), so a question like "why can't I save?" has the message. */
function visibleError(): string | undefined {
  if (typeof document === "undefined") return undefined;
  for (const el of document.querySelectorAll('[role="alert"]')) {
    if (el.closest('[aria-label="My Assistant"]')) continue;
    const text = el.textContent?.trim();
    if (text) return text.slice(0, 300);
  }
  return undefined;
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
  // The same chat, as a docked side panel or as a centred window (⌘J, or the expand button).
  const [mode, setMode] = useState<"panel" | "window">("panel");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<AssistantLang>("auto");
  const router = useRouter();
  const pathname = usePathname();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pages = useMemo(
    () => getNavPages(isAdmin, isSuperAdmin, allowedModules).map(({ href, label, group }) => ({ href, label, group })),
    [isAdmin, isSuperAdmin, allowedModules]
  );

  // The screen the person is on, by the closest sidebar page, so the assistant visibly knows where it is.
  const where = useMemo(() => {
    const hit = pages.filter((pg) => pathname === pg.href || pathname.startsWith(pg.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
    return hit?.label ?? null;
  }, [pages, pathname]);

  // The chosen language is remembered on this device.
  useEffect(() => {
    try {
      const saved = localStorage.getItem("assistant-lang");
      if (isAssistantLang(saved)) setLang(saved);
    } catch {
      /* private mode: stays on Auto */
    }
  }, []);
  const t = stringsFor(lang);

  function chooseLang(v: AssistantLang) {
    setLang(v);
    try {
      localStorage.setItem("assistant-lang", v);
    } catch {
      /* not saved; still applies to this session */
    }
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open && e.key === "Escape") setOpen(false);
      // ⌘J / Ctrl+J: the centred window from anywhere; again to close it.
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault();
        if (open && mode === "window") setOpen(false);
        else { setMode("window"); setOpen(true); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, mode]);

  // Lets a dashboard card (or anything else) open the assistant and
  // optionally ask a question straight away, without prop-drilling state.
  useEffect(() => {
    const onOpen = (e: Event) => {
      setOpen(true);
      const text = (e as CustomEvent<{ text?: string }>).detail?.text;
      if (text) send(text);
    };
    window.addEventListener("open-my-assistant", onOpen);
    return () => window.removeEventListener("open-my-assistant", onOpen);
  });

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    const started = performance.now();
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
          pages,
          language: lang,
          page: pathname,
          pageError: visibleError(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages([...next, { role: "assistant", content: data.answer || "I couldn't find a match.", links: data.links, table: data.table, needsSupport: data.needsSupport === true, secs: Math.max(0.1, Math.round((performance.now() - started) / 100) / 10) }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: e instanceof Error ? e.message : "Something went wrong.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  /** The question an answer replied to. */
  const questionFor = (i: number) => (messages[i - 1]?.role === "user" ? messages[i - 1].content : "");

  function rate(i: number, rating: "UP" | "DOWN") {
    const msg = messages[i];
    if (!msg || msg.rating) return;
    setMessages((all) => all.map((m, k) => (k === i ? { ...m, rating } : m)));
    void fetch("/api/assistant/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: questionFor(i), answer: msg.content, rating, page: pathname }),
    }).catch(() => undefined);
  }

  /** Sends the conversation, the screen and the person's name to the support inbox in one click. */
  async function sendToSupport(i: number) {
    setMessages((all) => all.map((m, k) => (k === i ? { ...m, support: "sending" } : m)));
    const question = questionFor(i);
    const transcript = messages
      .slice(0, i + 1)
      .slice(-8)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n\n");
    const fd = new FormData();
    fd.set("subject", `Assistant couldn't help: ${question.slice(0, 70) || "a question"}`);
    fd.set("message", `The in-app assistant could not resolve this.\n\n${transcript}`);
    fd.set("page", pathname);
    const res = await submitSupportTicketAction({ error: undefined, ok: false }, fd).catch(() => ({ ok: false as const }));
    setMessages((all) => all.map((m, k) => (k === i ? { ...m, support: res.ok ? "sent" : undefined } : m)));
  }

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  const empty = messages.length === 0;
  const isWindow = mode === "window";
  // Server and first client render agree (not a Mac); the real answer arrives right after.
  const mac = useSyncExternalStore(() => () => {}, () => /Mac|iPhone|iPad/.test(navigator.platform), () => false);
  const shortcut = mac ? "⌘ J" : "Ctrl J";

  const composer = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send(input);
      }}
      className={cn(isWindow ? "flex-1" : "p-3 pt-1 sm:p-4 sm:pt-1")}
    >
      <div className={cn("flex items-center gap-2 bg-surface transition-shadow", isWindow ? "rounded-full py-1 pr-1 pl-1 focus-within:shadow-[0_0_0_2px_var(--brand-primary-border)]" : "rounded-full border border-default py-1.5 pr-1.5 pl-5 shadow-[0_12px_36px_-12px_rgba(60,40,150,.35)] focus-within:border-[var(--brand-primary)] focus-within:shadow-[0_12px_36px_-10px_rgba(86,69,212,.5)]")}>
        {isWindow && <Orb size={30} glow />}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          placeholder={t.placeholder}
          dir="auto"
          aria-label="Ask My Assistant"
          // The pill carries the focus ring, so the field itself shows none.
          style={{ outline: "none", boxShadow: "none", border: 0 }}
          className={cn("min-w-0 flex-1 bg-transparent text-primary placeholder:text-muted", isWindow ? "px-2 py-2 text-[17px]" : "py-2 text-[14.5px]")}
        />
        <kbd className="hidden shrink-0 rounded-md border border-b-2 border-default bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-muted sm:inline">{shortcut}</kbd>
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-[0_8px_20px_-6px_rgba(86,69,212,.7)] transition-all hover:scale-105 disabled:opacity-40 disabled:shadow-none"
          style={{ background: GRADIENT }}
        >
          <ArrowUp className="h-4.5 w-4.5" />
        </button>
      </div>
      {!isWindow && <p className="mt-2 text-center text-[11px] text-subtle">{t.footnote}</p>}
    </form>
  );

  const conversation = (
    <div className={cn("flex-1 space-y-5 overflow-y-auto px-5 py-4", isWindow ? "max-h-[min(30rem,calc(100dvh-14rem))]" : "")} aria-live="polite" dir={lang === "ur" ? "rtl" : undefined}>
      {empty && (
        <m.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 pt-1">
          <div className="space-y-1.5">
            <p className="text-[26px] leading-tight font-bold tracking-tight text-primary">{t.hello}</p>
            <p className="text-sm text-secondary">{t.sub}</p>
          </div>
          <div className={cn("grid gap-2.5", isWindow ? "sm:grid-cols-2" : "grid-cols-1")}>
            {t.suggestions.map((text, i) => {
              const Icon = SUGGESTION_ICONS[i];
              return (
                <m.button
                  key={text}
                  type="button"
                  onClick={() => send(text)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i + 0.1 }}
                  className="group/s flex items-center gap-3 rounded-2xl border border-default bg-surface/90 px-3.5 py-3 text-left text-sm font-medium text-primary shadow-[0_6px_18px_-12px_rgba(60,40,150,.4)] transition-all hover:-translate-y-0.5 hover:border-[var(--brand-primary-border)] hover:shadow-[0_14px_28px_-14px_rgba(86,69,212,.45)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">{text}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-subtle opacity-0 transition-all group-hover/s:translate-x-0.5 group-hover/s:opacity-100" />
                </m.button>
              );
            })}
            <button
              type="button"
              onClick={() => send(t.thisScreen)}
              className={cn("flex items-center gap-3 rounded-2xl border border-dashed border-default px-3.5 py-3 text-left text-sm text-secondary transition-colors hover:border-[var(--brand-primary)] hover:text-primary", isWindow && "sm:col-span-2")}
            >
              <Sparkles className="h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 flex-1">{t.thisScreen}</span>
            </button>
          </div>
        </m.div>
      )}

      {messages.map((msg, i) => (
        <m.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={cn("flex flex-col gap-2.5", msg.role === "user" ? "items-end" : "items-start")}
        >
          {msg.role === "user" ? (
            <p className="max-w-[88%] rounded-[22px] rounded-br-md px-4 py-2.5 text-[14.5px] leading-relaxed font-medium whitespace-pre-wrap text-white shadow-[0_10px_26px_-10px_rgba(86,69,212,.6)]" style={{ background: GRADIENT }} dir="auto">
              {msg.content}
            </p>
          ) : msg.error ? (
            <p className="max-w-[92%] rounded-2xl bg-error-soft px-4 py-2.5 text-sm text-[var(--error)]" dir="auto">{msg.content}</p>
          ) : (
            <div className="w-full space-y-3">
              {msg.secs !== undefined && (
                <p className="flex items-center gap-2 text-[11.5px] text-muted"><Orb size={16} /> {t.answeredIn(msg.secs)}</p>
              )}
              <RichText text={msg.content} />
            </div>
          )}
          {msg.table && (
            <div className="w-full max-w-full">
              <ResultTable
                table={msg.table}
                downloadLabel={t.downloadCsv}
                showing={msg.table.total > msg.table.rows.length ? t.showing(msg.table.rows.length, msg.table.total) : null}
              />
            </div>
          )}
          {msg.links && msg.links.length > 0 && (
            <div className="flex w-full flex-col gap-2">
              {msg.links.map((l, k) => (
                <button
                  key={l.href}
                  type="button"
                  onClick={() => go(l.href)}
                  className={cn(
                    "group/l flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-left transition-all hover:-translate-y-0.5",
                    k === 0 ? "border-transparent text-white shadow-[0_12px_28px_-12px_rgba(86,69,212,.7)]" : "border-default bg-surface shadow-[0_6px_18px_-12px_rgba(60,40,150,.4)] hover:border-[var(--brand-primary-border)]"
                  )}
                  style={k === 0 ? { background: GRADIENT } : undefined}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-sm font-semibold", k === 0 ? "text-white" : "text-primary")}>{l.label}</span>
                    <span className={cn("block truncate text-xs", k === 0 ? "text-white/75" : "text-muted")}>{l.group}</span>
                  </span>
                  <ArrowRight className={cn("h-4 w-4 shrink-0 transition-transform group-hover/l:translate-x-0.5", k === 0 ? "text-white" : "text-brand")} />
                </button>
              ))}
            </div>
          )}
          {msg.role === "assistant" && !msg.error && (
            <div className="flex w-full flex-wrap items-center gap-2 text-[11.5px] text-muted">
              {msg.rating ? (
                <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" aria-hidden /> {t.thanks}</span>
              ) : (
                <>
                  <button type="button" onClick={() => rate(i, "UP")} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors hover:bg-surface-hover hover:text-primary" aria-label={t.helpful}><ThumbsUp className="h-3.5 w-3.5" aria-hidden /> {t.helpful}</button>
                  <button type="button" onClick={() => rate(i, "DOWN")} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors hover:bg-surface-hover hover:text-primary" aria-label={t.notHelpful}><ThumbsDown className="h-3.5 w-3.5" aria-hidden /> {t.notHelpful}</button>
                </>
              )}
              {(msg.needsSupport || msg.rating === "DOWN") && (
                msg.support === "sent" ? (
                  <span className="inline-flex items-center gap-1 text-[var(--success)]"><Check className="h-3 w-3" aria-hidden /> {t.sentToSupport}</span>
                ) : (
                  <button type="button" disabled={msg.support === "sending"} onClick={() => sendToSupport(i)} className="inline-flex items-center gap-1 rounded-full border border-default bg-surface px-3 py-1 font-semibold text-primary transition-colors hover:border-[var(--brand-primary)] disabled:opacity-50">
                    <LifeBuoy className="h-3.5 w-3.5" aria-hidden /> {msg.support === "sending" ? t.sending : t.sendToSupport}
                  </button>
                )
              )}
            </div>
          )}
        </m.div>
      ))}

      {busy && <Thinking label={t.thinking} />}
      <div ref={endRef} />
    </div>
  );

  const headerControls = (
    <>
      <label className="flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-1.5 text-xs text-secondary dark:bg-white/10" title={t.language}>
        <Globe className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">{t.language}</span>
        <select value={lang} onChange={(e) => isAssistantLang(e.target.value) && chooseLang(e.target.value)} className="cursor-pointer bg-transparent text-xs outline-none [&>option]:text-black">
          {LANGUAGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>
      {!empty && (
        <button type="button" onClick={() => setMessages([])} aria-label="Start a new chat" title={t.newChat} className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-secondary transition-colors hover:bg-black/10 dark:bg-white/10">
          <RotateCcw className="h-4 w-4" />
        </button>
      )}
      <button type="button" onClick={() => setMode(isWindow ? "panel" : "window")} aria-label={isWindow ? t.dock : t.expand} title={isWindow ? t.dock : t.expand} className="hidden h-8 w-8 items-center justify-center rounded-full bg-black/5 text-secondary transition-colors hover:bg-black/10 sm:flex dark:bg-white/10">
        {isWindow ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
      <button type="button" onClick={() => setOpen(false)} aria-label="Close My Assistant" className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-secondary transition-colors hover:bg-black/10 dark:bg-white/10">
        <X className="h-4 w-4" />
      </button>
    </>
  );

  return (
    <>
      <AnimatePresence>
        {!open && (
          <m.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={SPRING}
            className="group fixed right-4 bottom-4 z-40 h-14 w-14 sm:right-6 sm:bottom-6"
          >
            <span className="absolute inset-0 animate-ping rounded-full opacity-25 [animation-duration:2.6s]" style={{ background: GRADIENT }} aria-hidden />
            <m.button
              type="button"
              onClick={() => { setMode("panel"); setOpen(true); }}
              aria-label="Open My Assistant"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              transition={SPRING}
              className="relative flex h-14 w-14 items-center justify-center rounded-full bg-surface shadow-popover"
            >
              <Orb size={38} glow />
            </m.button>
            <span className="pointer-events-none absolute top-1/2 right-full mr-3 hidden -translate-y-1/2 items-center gap-2 rounded-control bg-[var(--text)] px-2.5 py-1 text-xs font-medium whitespace-nowrap text-[var(--surface)] opacity-0 shadow-popover transition-opacity duration-150 group-hover:opacity-100 sm:flex">
              My Assistant <kbd className="rounded border border-white/25 px-1 text-[10px]">{shortcut}</kbd>
            </span>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && isWindow && (
          <m.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-[#120e2d]/40 backdrop-blur-md"
            aria-hidden
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <m.section
            key={mode}
            role="dialog"
            aria-label="My Assistant"
            initial={{ opacity: 0, y: isWindow ? -12 : 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isWindow ? -8 : 12, scale: 0.98 }}
            transition={SPRING}
            style={{ transformOrigin: isWindow ? "top center" : "bottom right" }}
            className={cn(
              "fixed z-50 flex flex-col overflow-hidden border border-white/70 shadow-[0_30px_90px_-20px_rgba(40,25,120,.5)] dark:border-white/10",
              GLASS,
              isWindow
                ? "inset-x-3 top-[8vh] max-h-[84dvh] rounded-[28px] sm:inset-x-auto sm:left-1/2 sm:w-[46rem] sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2"
                : "inset-0 rounded-none sm:inset-auto sm:top-3 sm:right-3 sm:bottom-3 sm:w-[29rem] sm:rounded-[28px]"
            )}
          >
            {/* Soft colour behind the glass. */}
            <span aria-hidden className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-[#7c5cff] opacity-25 blur-[70px]" />
            <span aria-hidden className="pointer-events-none absolute -right-16 top-24 h-56 w-56 rounded-full bg-[#ff7ad9] opacity-20 blur-[70px]" />
            <span aria-hidden className="pointer-events-none absolute -bottom-20 left-24 h-56 w-72 rounded-full bg-[#4fb3ff] opacity-20 blur-[70px]" />

            {isWindow ? (
              <div className="relative flex items-center gap-3 px-5 pt-5 pb-3">
                {composer}
                <div className="flex items-center gap-1.5">{headerControls}</div>
              </div>
            ) : (
              <header className="relative flex items-center gap-3 px-5 pt-5 pb-3">
                <Orb size={38} glow />
                <div className="min-w-0 flex-1">
                  <p className="text-[17px] leading-tight font-bold tracking-tight text-primary">My Assistant</p>
                  <p className="flex items-center gap-1.5 truncate text-[12.5px] text-muted">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                    {where ? t.lookingAt(where) : t.ready}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">{headerControls}</div>
              </header>
            )}

            {isWindow && where && (
              <div className="relative flex items-center gap-2 px-5 pb-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand"><span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]" aria-hidden />{where}</span>
                <span className="text-xs text-muted">{t.lookingAt(where)}</span>
              </div>
            )}
            {isWindow && <div className="relative h-px bg-gradient-to-r from-transparent via-[var(--brand-primary-border)] to-transparent" />}

            <div className="relative flex min-h-0 flex-1 flex-col">{conversation}</div>

            {!isWindow && <div className="relative">{composer}</div>}
            {isWindow && (
              <div className="relative flex items-center gap-3 border-t border-default bg-surface-subtle/70 px-5 py-2.5 text-[11.5px] text-muted">
                <span>{t.footnote}</span>
                <span className="ml-auto inline-flex items-center gap-1.5"><kbd className="rounded border border-b-2 border-default bg-surface px-1.5 text-[10.5px] font-semibold">esc</kbd> {t.close}</span>
              </div>
            )}
          </m.section>
        )}
      </AnimatePresence>
    </>
  );
}
