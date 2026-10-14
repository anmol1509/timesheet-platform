import Link from "next/link";
import { headers } from "next/headers";
import { FileQuestion } from "lucide-react";
import { isMarketingHost } from "@/lib/seo/site";

/**
 * Root-level 404 — for a URL that matches no route at all (not even inside
 * the authenticated shell), so it renders outside `(app)/layout.tsx` and
 * can't assume branch/user data is loaded. Before this existed, an unknown
 * URL fell through to Next's bare unstyled default (flagged in the Phase 0
 * audit, finding X14).
 *
 * On the public marketing domain (where proxy.ts answers unknown URLs with a
 * real 404) it points visitors at the site, not at a dashboard they can't
 * reach. Elsewhere proxy.ts has already let the request through, so the
 * visitor is signed in and "Back to dashboard" is safe without re-checking auth.
 */
export default async function RootNotFound() {
  const marketing = isMarketingHost((await headers()).get("host"));
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
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Link href="/" className="btn btn-primary btn-sm">
              {marketing ? "Back to home" : "Back to dashboard"}
            </Link>
            {marketing && (
              <>
                <Link href="/solutions" className="btn btn-secondary btn-sm">Solutions</Link>
                <Link href="/blog" className="btn btn-secondary btn-sm">Blog</Link>
              </>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
