"use client";

import { createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { can, canWrite, moduleForPath, type PermissionAction, type PermissionSubject } from "@/lib/permissions";

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
  return useCanAt(usePathname() ?? "", action);
}

/** The same question for another page, such as the page a "New" button opens. */
export function useCanAt(pathname: string, action: PermissionAction): boolean {
  const subject = useContext(Subject);
  if (!subject) return true;
  const target = moduleForPath(pathname);
  return target === null ? true : can(subject, target, action);
}

/** Whether the person may change anything at all in this part of the app (create, edit, delete or approve). View-only people may not. */
export function useCanWriteHere(): boolean {
  const subject = useContext(Subject);
  const pathname = usePathname() ?? "";
  if (!subject) return true;
  const target = moduleForPath(pathname);
  return target === null ? true : canWrite(subject, target);
}

/** Shows its children only to people with this right in the part of the app they are on. */
export function Allowed({ action, children }: { action: PermissionAction; children: React.ReactNode }) {
  return useCanHere(action) ? <>{children}</> : null;
}

/** A link to a page that creates something ("…/new"): drawn only for people who may create there. */
export function NewLink(props: React.ComponentProps<typeof Link>) {
  const href = typeof props.href === "string" ? props.href : props.href.pathname ?? "";
  const allowed = useCanAt(href, "create");
  return allowed ? <Link {...props} /> : null;
}
