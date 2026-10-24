import type ExcelJS from "exceljs";

/** Pixel size of a PNG or JPEG, read from its header; null when it can't be read. */
export function imageSize(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length > 24 && bytes.readUInt32BE(0) === 0x89504e47) return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
      i += 2 + bytes.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** The size to draw an image so it fits inside `maxW` x `maxH` without changing its proportions. */
export function fitInside(size: { width: number; height: number } | null, maxW: number, maxH: number) {
  if (!size || size.width <= 0 || size.height <= 0) return { width: maxW, height: maxH };
  const k = Math.min(maxW / size.width, maxH / size.height);
  return { width: Math.max(1, Math.round(size.width * k)), height: Math.max(1, Math.round(size.height * k)) };
}

/**
 * Puts a logo (a PNG or JPEG data URI) on a worksheet. `col`/`row` are 0-based; the image is drawn at `width` x `height`
 * pixels. Anything that isn't a readable PNG/JPEG data URI is skipped, so a bad logo never breaks the workbook.
 */
export function addSheetLogo(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, dataUri: string | null | undefined, at: { col: number; row?: number; width?: number; height?: number } = { col: 0 }) {
  // width/height are the largest box the logo may take; it keeps its own proportions inside it.
  const m = dataUri?.match(/^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/i);
  if (!m) return false;
  const id = wb.addImage({ base64: m[2], extension: /^png$/i.test(m[1]) ? "png" : "jpeg" });
  const ext = fitInside(imageSize(Buffer.from(m[2], "base64")), at.width ?? 96, at.height ?? 52);
  ws.addImage(id, { tl: { col: at.col, row: at.row ?? 0 }, ext, editAs: "oneCell" });
  return true;
}

/** The 0-based column to start a logo of `px` pixels so it ends at the right edge of columns 1..n (Excel widths are in characters). */
export function rightEdgeColumn(widths: number[], px: number): number {
  let used = 0;
  for (let i = widths.length - 1; i >= 0; i--) {
    used += Math.round(widths[i] * 7 + 5);
    if (used >= px) return i;
  }
  return 0;
}
