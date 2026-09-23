"use server";

import { redirect } from "next/navigation";
import { clearVendorCookie } from "@/lib/vendor/session";

export async function vendorSignOutAction() {
  await clearVendorCookie();
  redirect("/vendor/login");
}
