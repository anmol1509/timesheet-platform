import { NextResponse } from "next/server";
import { requireImporter } from "@/lib/importer/access";
import { loadSample, removeSample } from "@/lib/importer/sample";

export const maxDuration = 60;

/** Load the sample company into this company's account. */
export async function POST() {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  try {
    return NextResponse.json(await loadSample(who.branchId, who.user));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not load the sample." }, { status: 409 });
  }
}

/** Remove it again. */
export async function DELETE() {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  try {
    return NextResponse.json(await removeSample(who.branchId));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not remove the sample." }, { status: 409 });
  }
}
