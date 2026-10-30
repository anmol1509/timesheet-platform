import Link from "next/link";
import { SearchX } from "lucide-react";
import { ErrorScreen } from "@/components/ErrorScreen";

export default function NotFound() {
  return (
    <ErrorScreen
      icon={<SearchX className="h-7 w-7" strokeWidth={1.75} aria-hidden />}
      tone="neutral"
      title="We can’t find that page"
      message="The record may have been deleted, or the link is out of date. Head back and look it up from the list."
    >
      <Link href="/" className="btn btn-primary">
        Back to dashboard
      </Link>
      <Link href="/employees" className="btn btn-secondary">
        Browse employees
      </Link>
    </ErrorScreen>
  );
}
