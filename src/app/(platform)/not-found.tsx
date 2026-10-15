import Link from "next/link";
import { FileQuestion } from "lucide-react";

/**
 * 404 for a signed-in visitor on a platform route (login, employee and supplier
 * portals) that calls notFound(). Unknown URLs that match no route at all are
 * handled by ../global-not-found.tsx. The (app) group has its own, which
 * keeps the dashboard shell around the message.
 */
export default function PlatformNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center">
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
    </div>
  );
}
