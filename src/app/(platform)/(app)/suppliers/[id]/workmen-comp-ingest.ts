import { linkWorkmenCompCoverageAction, uploadWorkmenCompAction } from "../actions";

export type WcIngest = { id?: string; expiry: string; names: string[]; linked: number; unmatched: string[]; error?: string };

/**
 * Files one workmen compensation certificate for a company and links its workers: the expiry date and the insured names
 * are read from the file (best effort), the file is stored with those names, and the workers named on it are linked to it
 * (which also files a copy on each of their profiles). Shared by the company page and the side panel, so a certificate
 * behaves the same wherever it is added.
 */
export async function ingestWorkmenComp(supplierId: string, file: File, expiryOverride?: string): Promise<WcIngest> {
  const meta = new FormData();
  meta.append("file", file);
  const [c, e] = await Promise.all([
    fetch("/api/documents/extract-company", { method: "POST", body: meta }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch("/api/documents/extract-employees", { method: "POST", body: meta }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  const read = /^\d{4}-\d{2}-\d{2}$/.test(c?.documentExpiry ?? "") ? (c.documentExpiry as string) : "";
  const expiry = /^\d{4}-\d{2}-\d{2}$/.test(expiryOverride ?? "") ? expiryOverride! : read;
  const names = [...new Set(((e?.employees ?? []) as { name: string | null }[]).map((x) => (x.name ?? "").trim()).filter(Boolean))];
  const form = new FormData();
  form.append("supplierId", supplierId);
  form.append("file", file);
  if (expiry) form.append("expiryDate", expiry);
  if (names.length > 0) form.append("names", JSON.stringify(names));
  const up = await uploadWorkmenCompAction(form);
  if (!up.id) return { expiry, names, linked: 0, unmatched: [], error: up.error ?? "Could not upload." };
  const link = names.length > 0 ? await linkWorkmenCompCoverageAction(supplierId, names, up.id) : { linked: 0, unmatched: [] as string[] };
  return { id: up.id, expiry, names, linked: link.linked, unmatched: link.unmatched };
}
