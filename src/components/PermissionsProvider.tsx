"use client";

import { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import { can, moduleForPath, type PermissionAction, type PermissionSubject } from "@/lib/permissions";

const Subject = createContext<PermissionSubject | null>(null);

/** Gives the screens the signed-in person's role and permissions, so a button they can't use is not drawn at all. The server still checks every action. */
export function PermissionsProvider({ subject, children }: { subject: PermissionSubject; children: React.ReactNode }) {
  return <Subject.Provider value={subject}>{children}</Subject.Provider>;
}

/**
 * Whether the person may do `action` in the part of the app they are on (the page's own permission, else its module's). Pages outside
 * every permission module, such as settings, are not decided here: those are guarded by the server. Without a provider, everything shows.
 */
export function useCanHere(action: PermissionAction): boolean {
  const subject = useContext(Subject);
  const pathname = usePathname();
  if (!subject) return true;
  const target = moduleForPath(pathname ?? "");
  return target === null ? true : can(subject, target, action);
}
