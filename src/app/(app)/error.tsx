"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";

/**
 * Segment-level error boundary for every authenticated page. Keeps the shell
 * (sidebar, header) intact so the user can navigate away instead of hitting a
 * dead end.
 *
 * Note: this Next.js version names the recovery callback `unstable_retry`,
 * not `reset` — see node_modules/next/dist/client/components/error-boundary.d.ts.
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card max-w-md p-6 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--error-soft)] text-[var(--error)]">
          <AlertTriangle className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="text-base font-semibold text-primary">
          Something went wrong
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          This page couldn&rsquo;t be loaded. Your data hasn&rsquo;t been
          changed — retrying is safe.
        </p>
        {error.digest && (
          <p className="mt-3 rounded-md bg-surface-sunken px-2 py-1 font-mono text-[11px] text-subtle">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="btn btn-primary btn-sm"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </button>
          <Link href="/" className="btn btn-secondary btn-sm">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
