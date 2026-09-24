/**
 * The tiny formatting language letter bodies use — kept deliberately small so a
 * template stays readable as plain text and the PDF, the live preview and the
 * editor toolbar all agree on it:
 *
 *   **bold**            bold text
 *   - item              a bullet (one per line)
 *   blank line / new line   starts a new paragraph
 *
 * Merge fields (%%CLIENTNAME%%) are substituted before this runs.
 */
export type Run = { text: string; bold: boolean };
export type Block = { type: "p" | "li"; runs: Run[] };

function parseRuns(line: string): Run[] {
  const parts = line.split("**");
  const runs: Run[] = [];
  parts.forEach((text, i) => {
    if (text) runs.push({ text, bold: i % 2 === 1 });
  });
  // An unmatched ** would leave the tail bold; treat a dangling opener as literal instead.
  if (parts.length % 2 === 0) return [{ text: line.replace(/\*\*/g, ""), bold: false }];
  return runs;
}

export function parseLetterBody(text: string): Block[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => {
      const bullet = /^[-•]\s+(.*)$/.exec(l);
      return bullet ? { type: "li" as const, runs: parseRuns(bullet[1]) } : { type: "p" as const, runs: parseRuns(l) };
    });
}
