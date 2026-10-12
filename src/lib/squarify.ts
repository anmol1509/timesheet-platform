/** Standard "squarified" treemap layout (Bruls, Huizing, van Wijk) — lays out
 * items as nested rectangles whose area is proportional to `value`, keeping
 * aspect ratios close to square rather than one long sliver per item. Runs
 * against a fixed logical W×H box; the caller renders that box at any real
 * size via CSS percentages (and typically an `aspect-ratio` matching W:H). */
export type TreemapInput = { key: string; value: number };
export type TreemapRect<T> = T & { x: number; y: number; w: number; h: number };

function worstRatio(row: { area: number }[], rowArea: number, shortSide: number): number {
  if (row.length === 0 || rowArea <= 0 || shortSide <= 0) return Infinity;
  const thickness = rowArea / shortSide;
  let worst = 0;
  for (const item of row) {
    const side = item.area / thickness;
    const ratio = Math.max(thickness / side, side / thickness);
    if (ratio > worst) worst = ratio;
  }
  return worst;
}

export function squarify<T extends TreemapInput>(items: T[], width: number, height: number): TreemapRect<T>[] {
  const positive = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = positive.reduce((s, i) => s + i.value, 0);
  if (total <= 0 || width <= 0 || height <= 0) return [];

  const scale = (width * height) / total;
  const scaled = positive.map((i) => ({ ...i, area: i.value * scale }));
  const results: TreemapRect<T>[] = [];
  let remaining = scaled;
  let container = { x: 0, y: 0, w: width, h: height };

  while (remaining.length > 0) {
    const shortSide = Math.min(container.w, container.h);
    let bestRow = [remaining[0]];
    let bestWorst = worstRatio(bestRow, bestRow[0].area, shortSide);
    for (let i = 2; i <= remaining.length; i++) {
      const candidate = remaining.slice(0, i);
      const candidateArea = candidate.reduce((s, c) => s + c.area, 0);
      const worst = worstRatio(candidate, candidateArea, shortSide);
      if (worst <= bestWorst) {
        bestWorst = worst;
        bestRow = candidate;
      } else break;
    }

    const rowArea = bestRow.reduce((s, c) => s + c.area, 0);
    const thickness = rowArea / shortSide;
    if (container.w >= container.h) {
      let y = container.y;
      for (const item of bestRow) {
        const h = item.area / thickness;
        const { area: _area, ...rest } = item;
        results.push({ ...rest, x: container.x, y, w: thickness, h } as unknown as TreemapRect<T>);
        y += h;
      }
      container = { x: container.x + thickness, y: container.y, w: container.w - thickness, h: container.h };
    } else {
      let x = container.x;
      for (const item of bestRow) {
        const w = item.area / thickness;
        const { area: _area, ...rest } = item;
        results.push({ ...rest, x, y: container.y, w, h: thickness } as unknown as TreemapRect<T>);
        x += w;
      }
      container = { x: container.x, y: container.y + thickness, w: container.w, h: container.h - thickness };
    }
    remaining = remaining.slice(bestRow.length);
  }
  return results;
}
