import { NextResponse } from "next/server";
import { authenticateOwnerRequest } from "@/lib/ownerApiServer";
import { collectStats } from "@/lib/ownerStats";

/** The owner's dashboard asks how this customer is getting on: people, employees, last active, AI credits. */
export async function GET(request: Request) {
  const auth = await authenticateOwnerRequest(request, "/api/owner/stats");
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(await collectStats());
}
