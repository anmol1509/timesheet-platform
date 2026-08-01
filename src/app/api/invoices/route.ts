import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getClientMonthEntries, summarizeInvoice, nextInvoiceNumber } from "@/lib/clientInvoice";
import { monthLabelFromKey } from "@/lib/timesheetSummary";
import { generateClientInvoiceXlsx } from "@/lib/generateXlsx";
import { generateClientInvoicePdf } from "@/lib/generatePdf";

const bodySchema = z.object({
  clientId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  format: z.enum(["xlsx", "pdf"]),
  save: z.boolean(),
  rates: z.record(z.string(), z.number()),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { clientId, month, format, save, rates } = parsed.data;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) {
    return NextResponse.json({ error: "Client not found." }, { status: 404 });
  }

  const entries = await getClientMonthEntries(clientId, month);
  if (entries.length === 0) {
    return NextResponse.json({ error: "No billable entries for this month." }, { status: 404 });
  }

  const entryIds = new Set(entries.map((e) => e.id));
  for (const id of Object.keys(rates)) {
    if (!entryIds.has(id)) {
      return NextResponse.json({ error: "Rate data mismatch." }, { status: 400 });
    }
  }

  const monthLabel = monthLabelFromKey(month);
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });

  const lines = entries.map((e) => ({
    employeeIdNo: e.employeeIdNo,
    employeeName: e.employeeName,
    trade: e.trade,
    totalHours: e.totalHours,
    billRate: rates[e.id] ?? e.billRate,
  }));

  const { subtotal, vatAmount, totalAmount } = summarizeInvoice(
    entries,
    Object.fromEntries(lines.map((l, i) => [entries[i].id, l.billRate]))
  );

  const issueDate = new Date();
  const dueDate = new Date(issueDate.getTime() + 30 * 24 * 60 * 60 * 1000);

  let invoiceNumber = `DRAFT-${month}`;
  if (save) {
    invoiceNumber = await nextInvoiceNumber();
    try {
      await prisma.clientInvoice.create({
        data: {
          invoiceNumber,
          month,
          monthLabel,
          subtotal,
          vatAmount,
          totalAmount,
          status: "SENT",
          issueDate,
          dueDate,
          clientId,
          generatedById: user.id,
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Could not issue invoice number. Try again." },
        { status: 409 }
      );
    }
  }

  const genInput = {
    invoiceNumber,
    issuedByName: settings.issuedTo,
    issuedByTrn: settings.companyTrn,
    monthLabel,
    issueDate,
    dueDate: save ? dueDate : null,
    clientName: client.name,
    clientTrn: client.trn,
    clientBillingAddress: client.billingAddress,
    lines,
  };

  let buffer: Buffer;
  let contentType: string;
  if (format === "xlsx") {
    buffer = await generateClientInvoiceXlsx(genInput);
    contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else {
    buffer = await generateClientInvoicePdf(genInput);
    contentType = "application/pdf";
  }

  const safeName = client.name.replace(/[^a-z0-9]+/gi, "-");
  const filename = `${safeName}-${month}-invoice.${format}`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Invoice-Number": invoiceNumber,
    },
  });
}
