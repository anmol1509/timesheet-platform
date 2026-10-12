import { NextResponse } from "next/server";
import { requireImporter } from "@/lib/importer/access";
import { buildTemplate } from "@/lib/importer/template";
import { TARGETS, isImportKind } from "@/lib/importer/targets";

export async function GET(_req: Request, { params }: { params: Promise<{ kind: string }> }) {
  const who = await requireImporter();
  if (who instanceof NextResponse) return who;
  const kind = (await params).kind.toUpperCase();
  if (!isImportKind(kind)) return NextResponse.json({ error: "Unknown template." }, { status: 404 });
  const buf = await buildTemplate(kind);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${TARGETS[kind].label.toLowerCase()}-import-template.xlsx"`,
    },
  });
}
