"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useToastActions } from "@/components/ui/Toast";
import { deleteClientsAction } from "./actions";

/**
 * Bulk delete for a selection of clients.
 *
 * Selection existed on this list already, but the only thing it affected was
 * the Export button's label — so the checkboxes looked like they did something
 * they didn't.
 */
export function DeleteClientsButton({
  ids,
  onDone,
}: {
  ids: string[];
  onDone?: () => void;
}) {
  const router = useRouter();
  const toast = useToastActions();
  const [pending, startTransition] = useTransition();

  function run() {
    const label = `${ids.length} client${ids.length === 1 ? "" : "s"}`;
    if (
      !confirm(
        `Delete ${label}? Any client still linked to a project or timesheet row is kept and reported back.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const { deleted, blocked } = await deleteClientsAction(ids);
      if (deleted > 0) {
        toast.success(`Deleted ${deleted} client${deleted === 1 ? "" : "s"}.`);
      }
      if (blocked.length > 0) {
        toast.error(
          `Kept ${blocked.length}: still in use`,
          blocked.map((b) => `${b.name} — ${b.reason}`).join("; ")
        );
      }
      onDone?.();
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending || ids.length === 0}
      className="inline-flex items-center gap-1.5 rounded-control border border-red-200 bg-surface px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" aria-hidden />
      Delete {ids.length}
    </button>
  );
}
