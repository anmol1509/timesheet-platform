import { NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/notifications/email";
import { SITE } from "@/app/welcome/content";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Public — hit from the marketing site's "Book a demo" dialog, no session.
// See src/proxy.ts: unauthenticated requests to /api/* pass through to the
// route itself rather than being redirected.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { name, email, phone, company } = body as Record<string, unknown>;
  if (
    typeof name !== "string" || !name.trim() ||
    typeof email !== "string" || !EMAIL_RE.test(email.trim()) ||
    typeof phone !== "string" || !phone.trim() ||
    typeof company !== "string" || !company.trim()
  ) {
    return NextResponse.json({ error: "Please fill in every field with a valid value." }, { status: 400 });
  }

  const demoRequest = await prisma.demoRequest.create({
    data: {
      name: name.trim().slice(0, 200),
      email: email.trim().slice(0, 200),
      phone: phone.trim().slice(0, 50),
      company: company.trim().slice(0, 200),
    },
  });

  // Best-effort notification, after the response — a slow/misconfigured
  // email provider must never delay or fail the visitor's submission.
  after(async () => {
    await sendEmail(
      SITE.demoNotifyEmail,
      `New demo request: ${demoRequest.company}`,
      `${demoRequest.name} (${demoRequest.company}) requested a demo.\n\nEmail: ${demoRequest.email}\nPhone: ${demoRequest.phone}`,
    );
  });

  return NextResponse.json({ ok: true });
}
