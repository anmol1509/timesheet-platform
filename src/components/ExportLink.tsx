"use client";

import { useState } from "react";

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

  async function download(url: string) {
    setBusy(true);
    setProblem(null);
    setNote(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as Problem | null;
        setProblem({ error: body?.error ?? "That file couldn't be made.", incomplete: body?.incomplete });
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
    } catch {
      setProblem({ error: "That file couldn't be made. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <a href={href} className={className} title={title} aria-busy={busy} onClick={(e) => { e.preventDefault(); if (!busy) void download(href); }}>
        {children}
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
