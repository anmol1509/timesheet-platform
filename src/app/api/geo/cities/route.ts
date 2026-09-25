import { NextResponse } from "next/server";
import cities from "@/data/cities.json";
import { COUNTRIES } from "@/lib/countries";

/**
 * City search for the emirate/city field: GET /api/geo/cities?country=India&q=mum
 * Public reference data (see /docs THIRD-PARTY notice: GeoNames, CC BY 4.0), so no session is needed,
 * which also lets the supplier portal use it. Results are the biggest matches first, capped so a
 * country like India (6,000+ cities) stays fast.
 */
const DATA = cities as Record<string, string[]>;
const LIMIT = 50;
const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const country = url.searchParams.get("country") ?? "";
  const q = fold((url.searchParams.get("q") ?? "").trim());
  const code = COUNTRIES.find((c) => c.name === country)?.code.toUpperCase();
  const list = (code && DATA[code]) || [];
  let out: string[];
  if (!q) out = list.slice(0, LIMIT);
  else {
    const starts: string[] = [];
    const contains: string[] = [];
    for (const name of list) {
      const f = fold(name);
      if (f.startsWith(q)) starts.push(name);
      else if (f.includes(q)) contains.push(name);
      if (starts.length >= LIMIT) break;
    }
    out = [...starts, ...contains].slice(0, LIMIT);
  }
  return NextResponse.json({ cities: out, total: list.length, known: list.length > 0 }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
