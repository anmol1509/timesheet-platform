"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requestOtp, verifyOtp } from "@/lib/ess/otp";
import { setEssCookie } from "@/lib/ess/session";

import { normalizePhone, maskPhone } from "@/lib/phone";

type State = { error: string | null; sent?: boolean; phone?: string; masked?: string };

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function requestCodeAction(prev: State, formData: FormData): Promise<State> {
  const phone = String(formData.get("phone") || "");
  const res = await requestOtp(phone, await clientIp());
  // Keep the code screen up if a *resend* is refused (cooldown / rate limit).
  const normalized = normalizePhone(phone);
  return res.ok
    ? { error: null, sent: true, phone: normalized ?? phone, masked: normalized ? maskPhone(normalized) : phone }
    : { error: res.error, sent: prev.sent, phone: prev.phone, masked: prev.masked };
}

export async function verifyCodeAction(_prev: State, formData: FormData): Promise<State> {
  const res = await verifyOtp(String(formData.get("phone") || ""), String(formData.get("code") || ""));
  if (!res.ok) return { error: res.error, sent: true, phone: String(formData.get("phone") || "") };
  await setEssCookie(res.employeeId);
  redirect("/me");
}
