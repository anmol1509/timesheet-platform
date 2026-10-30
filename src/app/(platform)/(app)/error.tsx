"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CloudOff, RotateCw } from "lucide-react";
import { ErrorScreen } from "@/components/ErrorScreen";

/**
 * Segment-level error boundary for every authenticated page. Keeps the shell
 * (sidebar, header) intact so the user can navigate away instead of hitting a
 * dead end.
 *
 * Note: this Next.js version passes the recovery callback as `retry` (older 16.x releases called it
 * `unstable_retry`) and also `reset`; use whichever is present — see node_modules/next/dist/client/components/error-boundary.d.ts.
 */
export default function AppError({
  error,
  retry,
  reset,
}: {
  error: Error & { digest?: string };
  retry?: () => void;
  reset?: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      icon={<CloudOff className="h-7 w-7" strokeWidth={1.75} aria-hidden />}
      title="That didn’t load"
      message="Something on our side got in the way. Nothing you entered has been lost or changed, so trying again is safe."
      reference={error.digest}
    >
      <button type="button" onClick={() => (retry ?? reset)?.()} className="btn btn-primary">
        <RotateCw className="h-4 w-4" aria-hidden />
        Try again
      </button>
      <Link href="/" className="btn btn-secondary">
        Back to dashboard
      </Link>
      <Link href="/support" className="basis-full text-sm font-medium text-muted underline-offset-4 hover:text-primary hover:underline">
        Contact support
      </Link>
    </ErrorScreen>
  );
}
