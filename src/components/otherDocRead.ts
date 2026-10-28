export type OtherDocRead = { name: string; expiry: string; docNumber: string; issueDate: string; holder: string };

/** Asks the AI what a file is called, its number, who it is for and when it was issued and expires. Resolves to null when it can't tell (not switched on, unreadable, too big). */
export async function readOtherDoc(file: File): Promise<OtherDocRead | null> {
  if (file.size > 4 * 1024 * 1024) return null;
  const fd = new FormData();
  fd.set("file", file);
  try {
    const res = await fetch("/api/documents/read", { method: "POST", body: fd });
    if (!res.ok) return null;
    const j = (await res.json()) as Partial<OtherDocRead>;
    return { name: j.name ?? "", expiry: j.expiry ?? "", docNumber: j.docNumber ?? "", issueDate: j.issueDate ?? "", holder: j.holder ?? "" };
  } catch {
    return null;
  }
}
