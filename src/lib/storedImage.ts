import { prisma } from "@/lib/db";

const MAX_IMAGE_BYTES = 700 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

/** Sniffs the real format from magic bytes — never trust the client's mime type. */
function sniff(buf: Buffer): string | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export type ImageResult = { id: string } | { error: string };

/**
 * Validates an uploaded image (PNG/JPEG/WebP only — SVG is refused because it
 * can carry script) and stores it. The caller links the returned id to a user
 * or branch and deletes the old row.
 */
export async function storeImage(file: FormDataEntryValue | null): Promise<ImageResult> {
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "Image is too large (max 700 KB after resizing)." };
  const buf = Buffer.from(await file.arrayBuffer());
  const mimeType = sniff(buf);
  if (!mimeType || !ALLOWED.includes(mimeType)) return { error: "Use a PNG, JPEG or WebP image." };
  const created = await prisma.storedImage.create({ data: { data: new Uint8Array(buf), mimeType } });
  return { id: created.id };
}

export async function deleteImage(id: string | null | undefined) {
  if (!id) return;
  await prisma.storedImage.delete({ where: { id } }).catch(() => {});
}
