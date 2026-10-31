"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToastActions } from "@/components/ui/Toast";

/**
 * When an action is refused for lack of permission (`?denied=1`), or can't be saved for a reason the form has no place to show (`?notice=…`),
 * the server brings the person back to the page they were on. This says why in plain words, then removes the marker from the address.
 */
export function DeniedNotice() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToastActions();
  const denied = params.get("denied") === "1";
  const notice = params.get("notice");
  useEffect(() => {
    if (!denied && !notice) return;
    if (notice) toast.error("That couldn’t be saved", notice);
    else toast.error("You don’t have permission to do that", "Your role doesn’t include this action. Ask an administrator if you need it.");
    const next = new URLSearchParams(params.toString());
    next.delete("denied");
    next.delete("notice");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [denied, notice]);
  return null;
}
