/** Stock status of an item or variant: owned units, and how many workers are holding. */
export const isOut = (owned: number, issued: number) => owned - issued <= 0;
/** Low = something left, but 20% or less of what is owned. */
export const isLowStock = (owned: number, issued: number) => owned > 0 && owned - issued > 0 && (owned - issued) / owned <= 0.2;
