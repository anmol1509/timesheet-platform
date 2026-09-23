import Link from "next/link";
import { FileQuestion } from "lucide-react";

/**
 * Root-level 404 — for a URL that matches no route at all (not even inside
 * the authenticated shell), so it renders outside `(app)/layout.tsx` and
 * can't assume branch/user data is loaded. Before this existed, an unknown
 * URL fell through to Next's bare unstyled default (flagged in the Phase 0
 * audit, finding X14). By the time this renders, proxy.ts has already let
 * the request through, so the visitor is signed in — the "Back to
 * dashboard" link is safe to show without re-checking auth here.
 */
export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-canvas text-[var(--text)] antialiased">
        <div className="card max-w-md p-6 text-center">
          <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface-sunken text-subtle">
            <FileQuestion className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-base font-semibold text-primary">Page not found</h1>
          <p className="mt-1.5 text-sm text-muted">
            That address doesn&rsquo;t match anything here. It may have been renamed, or the
            link is out of date.
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Link href="/" className="btn btn-primary btn-sm">
              Back to dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
