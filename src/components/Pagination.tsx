"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  pageCount,
  onPageChange,
  totalItems,
  pageSize,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
}) {
  if (pageCount <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 border-t border-default bg-surface-subtle px-3 py-2"
    >
      <p className="text-xs text-muted">
        <span className="tabular font-medium text-secondary">
          {start}–{end}
        </span>{" "}
        of <span className="tabular">{totalItems}</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="rounded-control border border-strong bg-surface p-1.5 text-muted shadow-xs transition hover:bg-surface-hover hover:text-primary disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="px-2 text-xs text-secondary" aria-current="page">
          Page <span className="tabular font-medium">{page}</span> of{" "}
          <span className="tabular">{pageCount}</span>
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
          className="rounded-control border border-strong bg-surface p-1.5 text-muted shadow-xs transition hover:bg-surface-hover hover:text-primary disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}
