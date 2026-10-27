/** Asks the AI what a file is called and when it expires. Resolves to null when it can't tell (not switched on, unreadable, too big). */
export async function readOtherDoc(file: File): Promise<{ name: string; expiry: string } | null> {
  if (file.size > 4 * 1024 * 1024) return null;
  const fd = new FormData();
  fd.set("file", file);
  try {
    const res = await fetch("/api/documents/read", { method: "POST", body: fd });
    if (!res.ok) return null;
    const j = (await res.json()) as { name?: string; expiry?: string };
    return { name: j.name ?? "", expiry: j.expiry ?? "" };
  } catch {
    return null;
  }
}
