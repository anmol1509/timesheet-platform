/**
 * The later of a supplier's own licence date and its licence file's date; null when neither is set.
 * (See supplierLicence.ts for why both are consulted.)
 */
export function effectiveLicenceExpiry(field: Date | null, file: Date | undefined): Date | null {
  if (field && file) return file.getTime() > field.getTime() ? file : field;
  return file ?? field;
}
