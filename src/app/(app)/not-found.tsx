import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="card max-w-md p-6 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface-sunken text-subtle">
          <FileQuestion className="h-5 w-5" aria-hidden />
        </span>
        <h1 className="text-base font-semibold text-primary">Page not found</h1>
        <p className="mt-1.5 text-sm text-muted">
          This record may have been deleted, or the link is out of date.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Link href="/" className="btn btn-primary btn-sm">
            Back to dashboard
          </Link>
          <Link href="/employees" className="btn btn-secondary btn-sm">
            Browse employees
          </Link>
        </div>
      </div>
    </div>
  );
}
