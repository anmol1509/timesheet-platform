"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { FileText, Paperclip, Undo2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToastActions } from "@/components/ui/Toast";
import { restoreDeletedAction } from "./actions";

type Item = { id: string; kind: string; label: string; detail: string | null; deletedByName: string; deletedAt: string; daysLeft: number; sizeKb: number };
type Done = { id: string; kind: string; label: string; restoredAt: string; restoredByName: string | null };

const KIND: Record<string, { label: string; Icon: typeof FileText }> = {
  EMPLOYEE: { label: "Worker", Icon: UserRound },
  DOCUMENT: { label: "Document", Icon: FileText },
  ATTACHMENT: { label: "File", Icon: Paperclip },
};

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" });

function Row({ item }: { item: Item }) {
  const router = useRouter();
  const toast = useToastActions();
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const k = KIND[item.kind] ?? { label: item.kind, Icon: FileText };

  function restore() {
    setError(null);
    start(async () => {
      const r = await restoreDeletedAction(item.id);
      if (!r.ok) { setError(r.error); return; }
      setDone(true);
      toast.success(`${item.label} is back`, r.notes[0]);
      setTimeout(() => router.refresh(), 900);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-muted"><k.Icon className="h-4 w-4" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-primary">{item.label} <span className="ml-1 rounded-full bg-surface-sunken px-1.5 py-px text-[10.5px] font-medium text-secondary">{k.label}</span></p>
        <p className="truncate text-xs text-muted">{item.detail ? `${item.detail} · ` : ""}Deleted by {item.deletedByName} on {when(item.deletedAt)}</p>
        {error && <p role="alert" className="mt-1 text-xs text-[var(--error)]">{error}</p>}
      </div>
      <span className="tabular text-xs text-muted">{item.daysLeft} day{item.daysLeft === 1 ? "" : "s"} left</span>
      <Button variant="secondary" size="btn-sm" loading={pending} success={done} successLabel="Restored" onClick={restore}><Undo2 className="h-3.5 w-3.5" aria-hidden />Restore</Button>
    </li>
  );
}

export function TrashList({ items, restored, q }: { items: Item[]; restored: Done[]; q: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(q);
  useEffect(() => {
    if (text.trim() === q) return;
    const t = setTimeout(() => router.replace(text.trim() ? `${pathname}?q=${encodeURIComponent(text.trim())}` : pathname, { scroll: false }), 400);
    return () => clearTimeout(t);
  }, [text, q, router, pathname]);

  return (
    <div className="space-y-5">
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by name…" aria-label="Search deleted records" className="input w-full max-w-xs" />
      {items.length === 0 ? (
        <div className="card px-4 py-12 text-center text-sm text-muted">{q ? "Nothing matches that." : "Nothing has been deleted lately."}</div>
      ) : (
        <ul className="card divide-y divide-[var(--border)] overflow-hidden">{items.map((i) => <Row key={i.id} item={i} />)}</ul>
      )}
      {restored.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Restored recently</h2>
          <ul className="card divide-y divide-[var(--border)] overflow-hidden text-sm">
            {restored.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0 truncate text-primary">{r.label} <span className="text-xs text-muted">({(KIND[r.kind]?.label ?? r.kind).toLowerCase()})</span></span>
                <span className="shrink-0 text-xs text-muted">Restored by {r.restoredByName ?? "someone"} on {when(r.restoredAt)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-subtle">A restored worker reopens from <Link href="/employees" className="text-[var(--brand-primary)] hover:underline">Workforce</Link>.</p>
        </section>
      )}
    </div>
  );
}
