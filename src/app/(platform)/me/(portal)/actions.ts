"use server";

import { redirect } from "next/navigation";
import { clearEssCookie } from "@/lib/ess/session";

export async function essSignOutAction() {
  await clearEssCookie();
  redirect("/me/login");
}
