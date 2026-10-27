import { NextResponse } from "next/server";
import { authenticateOwnerRequest, parseJson } from "@/lib/ownerApiServer";
import { provisionCompany, type CompanySetup } from "@/lib/provisionCompany";
import { isValidCustomerCode } from "@/lib/owner";

/**
 * Sets a new customer's workspace up on this deployment: the company, its AI credits and its first administrator with a
 * one-time link to choose a password. Called once by the owner's dashboard when a customer is added.
 */
export async function POST(request: Request) {
  const auth = await authenticateOwnerRequest(request, "/api/owner/bootstrap");
  if (auth instanceof NextResponse) return auth;
  const input = parseJson<{ code?: string; name?: string; emirate?: string | null; adminName?: string; adminEmail?: string; credits?: number; setup?: CompanySetup }>(auth.body);
  if (!input?.code || !isValidCustomerCode(input.code.toUpperCase()) || !input.name || !input.adminName || !input.adminEmail) return NextResponse.json({ error: "Company code, name and the administrator's name and email are needed." }, { status: 400 });
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") || new URL(request.url).origin;
  const res = await provisionCompany({ code: input.code, name: input.name, emirate: input.emirate ?? null, adminName: input.adminName, adminEmail: input.adminEmail, credits: Number(input.credits ?? 0), setup: input.setup, baseUrl });
  if ("error" in res) return NextResponse.json({ error: res.error }, { status: 409 });
  return NextResponse.json({ ok: true, branchId: res.branchId, inviteLink: res.inviteLink, inviteExpires: res.inviteExpires.toISOString() });
}
