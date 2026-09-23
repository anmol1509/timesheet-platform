"use client";

import { PhoneCodeLogin } from "@/components/PhoneCodeLogin";
import { requestCodeAction, verifyCodeAction } from "./actions";

export function EssLoginForm({ deliveryConfigured }: { deliveryConfigured: boolean }) {
  return <PhoneCodeLogin requestCodeAction={requestCodeAction} verifyCodeAction={verifyCodeAction} deliveryConfigured={deliveryConfigured} />;
}
