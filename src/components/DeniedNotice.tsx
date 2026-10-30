"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToastActions } from "@/components/ui/Toast";

/**
 * When an action is refused for lack of permission, the server brings the person back to the page they were on with `?denied=1`.
 * This says so in plain words, then removes the marker from the address so a refresh doesn't repeat it.
 */
export function DeniedNotice() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToastActions();
  const denied = params.get("denied") === "1";
  useEffect(() => {
    if (!denied) return;
    toast.error("You don’t have permission to do that", "Your role doesn’t include this action. Ask an administrator if you need it.");
    const next = new URLSearchParams(params.toString());
    next.delete("denied");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denied]);
  return null;
}
