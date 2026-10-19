import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionFromCookies } from "@/lib/session";
import { endSession } from "@/lib/userSessions";

export async function POST(request: Request) {
  // End the sign-in on the server too, so a copied cookie stops working when the person signs out.
  await endSession((await getSessionFromCookies())?.sid);
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/login", request.url));
}
