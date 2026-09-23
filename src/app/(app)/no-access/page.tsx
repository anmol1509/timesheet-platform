import Link from "next/link";
import { ShieldOff } from "lucide-react";

export const metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <div className="mx-auto mt-16 max-w-md text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-subtle">
        <ShieldOff className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-primary">You don&apos;t have access to this</h1>
      <p className="mt-1 text-sm text-muted">
        Your role doesn&apos;t include this page or action. Ask an administrator to update your permissions if you need it.
      </p>
      <Link href="/" className="btn btn-primary mt-5 inline-flex">
        Back to dashboard
      </Link>
    </div>
  );
}
