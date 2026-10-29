"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";

type Problem = { error: string; incomplete?: string[] };

/**
 * A download that says what went wrong on the page instead of opening a tab of raw JSON. It fetches the file, saves it, and shows
 * the server's message (for example who has incomplete bank details) beside the button. When the server lists people it could
 * not include and `skipHref` is given, a second button downloads the file without them. Names left out of a file are shown after.
 */
export function ExportLink({ href, skipHref, className, title, children }: { href: string; skipHref?: string; className?: string; title?: string; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"done" | "failed" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const flash = (o: "done" | "failed") => {
    setOutcome(o);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOutcome(null), o === "done" ? 1600 : 1100);
  };
  // Only button-styled links get the spinner and tick; a plain text link keeps its words.
  const variant = className?.includes("btn-secondary") ? "secondary" : className?.includes("btn-primary") ? "primary" : null;

  async function download(url: string) {
    setBusy(true);
    setProblem(null);
    setNote(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as Problem | null;
        setProblem({ error: body?.error ?? "That file couldn't be made.", incomplete: body?.incomplete });
        flash("failed");
        return;
      }
      const blob = await res.blob();
      const name = /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "download";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      const left = res.headers.get("x-left-out");
      if (left) setNote(`Left out of the file: ${decodeURIComponent(left)}`);
      else if (res.headers.get("x-note")) setNote(res.headers.get("x-note"));
      flash("done");
    } catch {
      setProblem({ error: "That file couldn't be made. Check your connection and try again." });
      flash("failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a
        href={href}
        className={variant ? `${className} btn-fx` : className}
        title={title}
        aria-busy={busy}
        data-variant={variant ?? undefined}
        data-state={variant ? (outcome === "done" ? "success" : outcome === "failed" ? "error" : busy ? "loading" : "idle") : undefined}
        onClick={(e) => { e.preventDefault(); if (!busy) void download(href); }}
      >
        {variant ? (
          <span className="ab-swap">
            <span data-on={(!busy && !outcome) || undefined}>{children}</span>
            <span data-on={(busy && !outcome) || undefined} aria-hidden={!busy}><Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />Preparing…</span>
            <span data-on={outcome === "done" || undefined} aria-hidden={outcome !== "done"}><Check className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden />Downloaded</span>
            <span data-on={outcome === "failed" || undefined} aria-hidden={outcome !== "failed"}><X className="h-4 w-4 shrink-0" strokeWidth={3} aria-hidden />Failed</span>
          </span>
        ) : (
          children
        )}
      </a>
      {problem && (
        <span role="alert" className="block w-full rounded-md border border-[var(--warning-border)] bg-[var(--warning-soft)] px-3 py-2 text-sm text-primary">
          {problem.error}
          {problem.incomplete && problem.incomplete.length > 0 && skipHref && (
            <button type="button" className="btn btn-secondary btn-sm ml-3" disabled={busy} onClick={() => void download(skipHref)}>Download without them</button>
          )}
        </span>
      )}
      {note && <span role="status" className="block w-full text-sm text-[var(--warning)]">{note}</span>}
    </>
  );
}
