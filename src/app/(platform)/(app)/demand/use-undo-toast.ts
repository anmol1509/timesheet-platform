"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { undoEntriesAction } from "./undo-actions";

/**
 * After an action that can be undone, shows "Done" with an Undo button for 15 seconds. Undo checks that nothing has
 * moved on since, then refreshes the page; if it can't, it says why.
 */
export function useUndoToast() {
  const toast = useToast();
  const router = useRouter();
  return useCallback(
    (title: string, entryIds: string[] | undefined, description?: string) => {
      toast({
        tone: "success",
        title,
        description,
        duration: 15_000,
        action: entryIds?.length
          ? {
              label: "Undo",
              run: async () => {
                const r = await undoEntriesAction(entryIds);
                router.refresh();
                return r;
              },
            }
          : undefined,
      });
    },
    [toast, router]
  );
}
