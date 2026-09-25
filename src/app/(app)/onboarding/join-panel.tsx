"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { markJoinedAction } from "./actions";

type State = { error: string | null; ok?: boolean };

export function JoinPanel({
  candidate,
}: {
  candidate: {
    id: string;
    readyToJoin: boolean;
    joined: boolean;
    joiningDate: Date | null;
    employeeId: string | null;
    agencyId: string | null;
    passportNumber: string | null;
    emiratesId: string | null;
    phone: string | null;
  };
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (_prev: State, fd: FormData) => {
      fd.set("id", candidate.id);
      const res = await markJoinedAction({ error: null }, fd);
      if (res.ok) router.refresh();
      return res;
    },
    { error: null } as State
  );

  if (candidate.joined) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success-text,#067647)]">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
        Joined{candidate.joiningDate ? ` on ${new Date(candidate.joiningDate).toLocaleDateString()}` : ""}
        {candidate.employeeId && (
          <>
            {" · "}
            <Link href={`/employees/${candidate.employeeId}`} className="underline hover:no-underline">
              View employee record
            </Link>
          </>
        )}
      </div>
    );
  }

  if (!candidate.readyToJoin) {
    return (
      <div className="rounded-lg bg-surface-subtle px-4 py-3 text-sm text-muted">
        Not ready to join yet — every stage below must be completed first.
      </div>
    );
  }

  const missing = [
    !candidate.agencyId && "agency",
    !candidate.passportNumber && "passport number",
    !candidate.emiratesId && "Emirates ID",
    !candidate.phone && "phone",
  ].filter(Boolean) as string[];

  if (missing.length > 0) {
    return (
      <div className="rounded-lg bg-[var(--warning-soft,#fef3c7)] px-4 py-3 text-sm text-[var(--warning-text,#92400e)]">
        Every stage is complete, but the candidate&rsquo;s profile is missing {missing.join(", ")} — add {missing.length > 1 ? "these" : "it"} below before marking them joined (needed to create their employee record).
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-lg bg-[var(--success-soft)] px-4 py-3">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--success-text,#067647)]">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> Ready to join
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Joining date</span>
        <DatePicker name="joiningDate" defaultValue={new Date().toISOString().slice(0, 10)} />
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Creating employee…" : "Mark joined & create employee"}
      </button>
      {state.error && <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>}
    </form>
  );
}
