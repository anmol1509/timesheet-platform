"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createSubsidiaryAction } from "../actions";

export function SubsidiaryTabs({
  currentId,
  rootId,
  rootName,
  subsidiaries,
}: {
  currentId: string;
  rootId: string;
  rootName: string;
  subsidiaries: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adding) return;
    function onClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setAdding(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [adding]);

  function submitAdd(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createSubsidiaryAction(formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setAdding(false);
      router.push(`/suppliers/${result.id}`);
    });
  }

  const tabs = [{ id: rootId, name: rootName }, ...subsidiaries];

  return (
    <div className="flex items-end gap-1 px-1">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={`/suppliers/${t.id}`}
          className={`rounded-t-xl border border-b-0 px-4 py-2 text-sm font-medium transition ${
            t.id === currentId
              ? "border-default bg-surface text-primary"
              : "border-transparent bg-surface-sunken text-muted hover:bg-[var(--border)]"
          }`}
        >
          {t.name}
        </Link>
      ))}
      <div className="relative" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          aria-label="Add subsidiary"
          title="Add subsidiary"
          className="rounded-t-xl px-3 py-2 text-sm font-medium text-subtle transition hover:bg-surface-hover hover:text-secondary"
        >
          +
        </button>
        {adding && (
          <form
            action={submitAdd}
            className="absolute left-0 top-full z-10 mt-1 flex w-64 flex-col gap-2 rounded-xl border border-default bg-surface p-3 shadow-lg"
          >
            <input type="hidden" name="parentSupplierId" value={rootId} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Subsidiary name
              </span>
              <input
                name="name"
                required
                autoFocus
                disabled={pending}
                placeholder="e.g. Top Peak - Sharjah"
                className="input w-full disabled:opacity-60"
              />
            </label>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdding(false)}
                disabled={pending}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-hover disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                className="btn btn-primary btn-sm"
              >
                {pending ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
