import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateLetterPdf } from "@/lib/generateLetterPdf";
import { SAMPLE_VALUES, SAMPLE_WORKERS, sampleBody } from "@/lib/letterSample";

// A real PDF of the template with sample data, so what's printed can be checked
// before any letter is issued. Nothing is stored.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "STAFF") return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { title, body } = (await request.json().catch(() => ({}))) as { title?: string; body?: string };
  if (!body || body.length > 6000) return NextResponse.json({ error: "Nothing to preview." }, { status: 400 });

  const buffer = await generateLetterPdf({
    title: (title || "Letter").slice(0, 120),
    clientName: SAMPLE_VALUES.CLIENTNAME,
    clientAddress: SAMPLE_VALUES.CLIENTADDRESS,
    projectName: SAMPLE_VALUES.PROJECTNAME,
    date: new Date(),
    sections: [{
      group: { supplierId: "sample", supplierName: SAMPLE_VALUES.COMPANYNAME, workers: SAMPLE_WORKERS },
      issuer: { name: SAMPLE_VALUES.COMPANYNAME, signatoryName: "Authorised Signatory", signatoryPhone: "+971 50 123 4567", signatoryEmail: "office@example.com", letterheadImage: null },
      bodyText: sampleBody(body),
    }],
  });
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="template-preview.pdf"', "Cache-Control": "no-store" } });
}
