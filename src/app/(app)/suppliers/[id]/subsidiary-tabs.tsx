"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  const [adding, setAdding] = useState(false);
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

  const tabs = [{ id: rootId, name: rootName }, ...subsidiaries];

  return (
    <div className="flex items-end gap-1 px-1">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={`/suppliers/${t.id}`}
          className={`rounded-t-xl border border-b-0 px-4 py-2 text-sm font-medium transition ${
            t.id === currentId
              ? "border-slate-200 bg-white text-slate-900"
              : "border-transparent bg-slate-100 text-slate-500 hover:bg-slate-200"
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
          className="rounded-t-xl px-3 py-2 text-sm font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          +
        </button>
        {adding && (
          <form
            action={createSubsidiaryAction}
            className="absolute left-0 top-full z-10 mt-1 flex w-64 flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          >
            <input type="hidden" name="parentSupplierId" value={rootId} />
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500">
                Subsidiary name
              </span>
              <input
                name="name"
                required
                autoFocus
                placeholder="e.g. Top Peak - Sharjah"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--brand-primary-hover)]"
              >
                Add
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
