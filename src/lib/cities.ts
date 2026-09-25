import { COUNTRIES } from "@/lib/countries";

/** The dial code (e.g. "+91") for a country name, or null if unknown. City lists live in src/data/cities.json and are served by /api/geo/cities. */
export function dialForCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  return COUNTRIES.find((c) => c.name === country)?.dial ?? null;
}
