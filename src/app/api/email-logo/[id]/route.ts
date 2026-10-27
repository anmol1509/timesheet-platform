import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// A company's logo for the top of an email. Email programs can't sign in, so this is public, but it serves nothing except a
// logo that a branch is actually using, and by its unguessable id: avatars and other images are never reachable here.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const branch = await prisma.branch.findFirst({ where: { logoId: id }, select: { id: true } });
  if (!branch) return new NextResponse("Not found", { status: 404 });
  const image = await prisma.storedImage.findUnique({ where: { id } });
  if (!image || !/^image\/(png|jpeg|gif|webp)$/.test(image.mimeType)) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mimeType, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}
