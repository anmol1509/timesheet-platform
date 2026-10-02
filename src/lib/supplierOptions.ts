// Pure helpers for the employee form's Supplier and Sponsor dropdowns.

export type SupplierOpt = { id: string; name: string; parentSupplierId?: string | null };

/** Supplier dropdown: primary suppliers only. `keepId` is an employee's saved value, kept visible even if it is a subsidiary. */
export function primaryOptions(all: SupplierOpt[], keepId?: string | null): SupplierOpt[] {
  return all.filter((s) => !s.parentSupplierId || s.id === keepId);
}

/** The primary supplier a chosen supplier belongs under. */
export function rootOf(all: SupplierOpt[], supplierId: string): string {
  const s = all.find((x) => x.id === supplierId);
  return s?.parentSupplierId ?? supplierId;
}

/**
 * Sponsor dropdown: the chosen primary supplier and its subsidiaries. With no supplier chosen yet
 * every company is offered. `keepId` is a saved sponsor, kept visible even if it falls outside.
 */
export function sponsorOptions(all: SupplierOpt[], supplierId: string, keepId?: string | null): SupplierOpt[] {
  if (!supplierId) return all;
  const root = rootOf(all, supplierId);
  return all.filter((s) => s.id === root || s.parentSupplierId === root || s.id === keepId);
}

/** Whether a sponsor still belongs with the supplier just picked (otherwise it should be cleared). */
export const sponsorFits = (all: SupplierOpt[], supplierId: string, sponsorId: string) =>
  !sponsorId || !supplierId || sponsorOptions(all, supplierId).some((s) => s.id === sponsorId);
