"use client";

import { PhoneCodeLogin } from "@/components/PhoneCodeLogin";
import { requestVendorCodeAction, verifyVendorCodeAction } from "./actions";

export function VendorLoginForm({ deliveryConfigured }: { deliveryConfigured: boolean }) {
  return <PhoneCodeLogin requestCodeAction={requestVendorCodeAction} verifyCodeAction={verifyVendorCodeAction} deliveryConfigured={deliveryConfigured} />;
}
