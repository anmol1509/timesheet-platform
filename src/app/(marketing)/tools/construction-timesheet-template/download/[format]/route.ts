import { buildTimesheetTemplatePdf, buildTimesheetTemplateXlsx } from "@/lib/timesheetTemplate";

// Built once at deploy time and served from the CDN; the template is the same for everyone.
export const dynamic = "force-static";

const FORMATS = {
  xlsx: {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    name: "labour-supply-timesheet-template.xlsx",
    build: async () => new Uint8Array(await buildTimesheetTemplateXlsx()),
  },
  pdf: {
    type: "application/pdf",
    name: "labour-supply-timesheet-template.pdf",
    build: () => buildTimesheetTemplatePdf(),
  },
} as const;

export function generateStaticParams() {
  return Object.keys(FORMATS).map((format) => ({ format }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ format: string }> }) {
  const f = FORMATS[(await params).format as keyof typeof FORMATS];
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(await f.build()), {
    headers: {
      "Content-Type": f.type,
      "Content-Disposition": `attachment; filename="${f.name}"`,
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
    },
  });
}
