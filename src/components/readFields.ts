/** Asks the AI to read one file as an invoice/bill or a person's ID papers. Resolves to null when it can't (not switched on, credits used up, unreadable, too big): the person then types it. */
export async function readFields(url: string, file: File, extra: Record<string, string> = {}): Promise<Record<string, string> | null> {
  if (file.size > 4 * 1024 * 1024) return null;
  const fd = new FormData();
  fd.set("file", file);
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  try {
    const res = await fetch(url, { method: "POST", body: fd });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, string>;
  } catch {
    return null;
  }
}
