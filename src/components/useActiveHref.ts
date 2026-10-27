"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { clearedHref, hrefIsActive } from "@/lib/activeHref";

/** For a card or chart item that links to a filtered list: whether it is the one on show, and where a click goes (a second click clears it). */
export function useActiveHref(href: string | undefined): { active: boolean; to: string | undefined } {
  const pathname = usePathname();
  const search = useSearchParams();
  if (!href) return { active: false, to: undefined };
  const active = hrefIsActive(href, pathname, search);
  const hasFilter = href.includes("?");
  return { active, to: active && hasFilter ? clearedHref(href, pathname, search) : href };
}
