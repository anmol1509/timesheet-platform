import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateLetterPdf } from "@/lib/generateLetterPdf";
import { generateEmployeeLetterPdf, PLAIN_LAYOUT } from "@/lib/generateEmployeeLetterPdf";
import { loadLogoDataUri } from "@/lib/letterhead";
import { SAMPLE_VALUES, SAMPLE_WORKERS } from "@/lib/letterSample";
import { EMPLOYEE_MERGE_FIELDS } from "@/lib/letterFields";
import { ASK_PREFIX, substituteInHtml, tokensIn } from "@/lib/letterHtml";
import { sanitizeLetterHtml } from "@/lib/letterSanitize";

// A real PDF of the template with sample data, so what's printed can be checked
// before any letter is issued. Nothing is stored.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role === "STAFF") return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const { title, html, audience } = (await request.json().catch(() => ({}))) as { title?: string; html?: string; audience?: string };
  if (!html || html.length > 40_000) return NextResponse.json({ error: "Nothing to preview." }, { status: 400 });
  const clean = sanitizeLetterHtml(html);

  let buffer: Buffer;
  if (audience === "EMPLOYEE") {
    const values: Record<string, string> = Object.fromEntries(EMPLOYEE_MERGE_FIELDS.map((f) => [f.key, f.example]));
    for (const t of tokensIn(clean)) if (t.startsWith(ASK_PREFIX)) values[t] = `[${t.slice(ASK_PREFIX.length)}]`;
    buffer = await generateEmployeeLetterPdf({
      letterhead: { name: SAMPLE_VALUES.COMPANYNAME, addressLines: ["Business Bay", "Dubai"], phone: "+971 4 123 4567", fax: null, email: "office@example.com", poBox: "12345", trn: "100000000000003", logo: await loadLogoDataUri() },
      refNo: values.REFNO, date: values.DATE, title: (title || "Letter").slice(0, 120), bodyHtml: substituteInHtml(clean, values), layout: PLAIN_LAYOUT,
    });
  } else {
    buffer = await generateLetterPdf({
      title: (title || "Letter").slice(0, 120),
      clientName: SAMPLE_VALUES.CLIENTNAME,
      clientAddress: SAMPLE_VALUES.CLIENTADDRESS,
      projectName: SAMPLE_VALUES.PROJECTNAME,
      date: new Date(),
      sections: [{
        group: { supplierId: "sample", supplierName: SAMPLE_VALUES.COMPANYNAME, workers: SAMPLE_WORKERS },
        issuer: { name: SAMPLE_VALUES.COMPANYNAME, signatoryName: "Authorised Signatory", signatoryPhone: "+971 50 123 4567", signatoryEmail: "office@example.com", letterheadImage: null },
        bodyHtml: substituteInHtml(clean, SAMPLE_VALUES),
      }],
    });
  }
  return new NextResponse(new Uint8Array(buffer), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="template-preview.pdf"', "Cache-Control": "no-store" } });
}
