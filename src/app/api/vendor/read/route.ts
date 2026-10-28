import { NextResponse } from "next/server";
import { getVendor } from "@/lib/vendor/session";
import { rateLimit } from "@/lib/rateLimit";
import { readFileFields } from "@/lib/aiRead";

export const maxDuration = 60;

/** The supplier portal's reader: an invoice for the invoice form, or a passport / Emirates ID for the add-worker form. Nothing is stored. */
export async function POST(request: Request) {
  const vendor = await getVendor();
  if (!vendor) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  const budget = rateLimit(`vendorread:${vendor.id}`, { limit: 100, windowMs: 60 * 60 * 1000 });
  if (!budget.allowed) return NextResponse.json({ error: "A lot of files were read in the last hour. Try again shortly." }, { status: 429, headers: { "Retry-After": String(budget.retryAfter) } });
  const form = await request.formData().catch(() => null);
  const kind = form?.get("kind") === "person" ? "person" : "invoice";
  const r = await readFileFields(kind, form?.get("file"), { branchId: vendor.branchId, userId: null, feature: `vendor-${kind}-read` });
  return "fields" in r ? NextResponse.json(r.fields) : NextResponse.json({ error: r.error }, { status: r.status });
}
