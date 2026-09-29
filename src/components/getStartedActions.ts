"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUserWithBranch } from "@/lib/auth";

const HIDE_COOKIE = "hide_get_started";

/** Hides (or brings back) the Get started card on this browser's dashboard. */
export async function setGetStartedHidden(hidden: boolean) {
  await requireUserWithBranch();
  const jar = await cookies();
  if (hidden) jar.set(HIDE_COOKIE, "1", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  else jar.delete(HIDE_COOKIE);
  revalidatePath("/");
  revalidatePath("/import");
}
