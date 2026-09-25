import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Temporary diagnostic route — reports whether DATABASE_URL is present/
// well-formed and the exact connection error, without ever exposing the
// secret itself. Delete once the Supabase connection issue is resolved.
export async function GET() {
  const url = process.env.DATABASE_URL ?? "";
  const info = {
    databaseUrlSet: url.length > 0,
    databaseUrlLength: url.length,
    startsWithPostgres: url.startsWith("postgres://") || url.startsWith("postgresql://"),
    host: (() => {
      try {
        return new URL(url).hostname;
      } catch {
        return "unparseable";
      }
    })(),
  };

  try {
    const result = await prisma.$queryRaw`SELECT 1 as ok`;
    return NextResponse.json({ ...info, queryOk: true, result });
  } catch (e) {
    return NextResponse.json({
      ...info,
      queryOk: false,
      errorName: e instanceof Error ? e.name : typeof e,
      errorMessage: e instanceof Error ? e.message : String(e),
    });
  }
}
