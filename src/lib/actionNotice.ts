import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isUniqueClash, uniqueClashMessage } from "@/lib/uniqueGuard";

/**
 * Brings the person back to the page they were on with a notice, for a form that has no place of its own to show an error.
 * The notice is shown by components/DeniedNotice and then removed from the address.
 */
export async function failBack(message: string): Promise<never> {
  const h = await headers();
  let back = "/";
  try {
    const ref = h.get("referer");
    const u = ref ? new URL(ref) : null;
    if (u && u.host === h.get("host")) {
      u.searchParams.set("notice", message.slice(0, 200));
      back = `${u.pathname}${u.search}`;
    }
  } catch {
    back = "/";
  }
  redirect(back);
}

/** Runs a save. If the database says that name or code already exists, the person goes back with a plain message instead of the error page. */
export async function orBack<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (isUniqueClash(e)) return failBack(uniqueClashMessage(e));
    throw e;
  }
}
