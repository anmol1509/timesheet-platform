import { prisma } from "@/lib/db";

/**
 * Proves that the ids a record is being linked to all belong to one branch.
 *
 * Server actions receive things like `supplierId` or `projectId` from a form.
 * Checking that the record being edited is the caller's is not enough: without
 * this, a tenant can attach its own record to another tenant's project or
 * supplier, and the record then shows up inside the other tenant's pages.
 *
 * `owner` is the branch the record lives in — the record's own branchId when
 * editing, the caller's branch when creating. It fails closed: with no owner
 * there is nothing to compare against, so any supplied link is refused rather
 * than allowed. Empty / null ids are ignored (an unset optional link is fine).
 */
type Ids = string | null | undefined | (string | null | undefined)[];

export type Refs = {
  supplier?: Ids;
  client?: Ids;
  project?: Ids;
  vehicle?: Ids;
  bank?: Ids;
  lpo?: Ids;
  /** A site has no branch of its own; it inherits its project's. */
  site?: Ids;
  inventoryItem?: Ids;
  /** A variant has no branch of its own; it inherits its item's. */
  inventoryVariant?: Ids;
};

const clean = (v: Ids) => [...new Set((Array.isArray(v) ? v : [v]).filter((x): x is string => !!x))];

export async function refsBelongToBranch(owner: string | null, refs: Refs): Promise<boolean> {
  const wanted = {
    supplier: clean(refs.supplier), client: clean(refs.client), project: clean(refs.project),
    vehicle: clean(refs.vehicle), bank: clean(refs.bank), lpo: clean(refs.lpo), site: clean(refs.site),
    inventoryItem: clean(refs.inventoryItem), inventoryVariant: clean(refs.inventoryVariant),
  };
  const any = Object.values(wanted).some((a) => a.length > 0);
  if (!any) return true;
  if (!owner) return false;

  const counts = await Promise.all([
    wanted.supplier.length ? prisma.supplier.count({ where: { id: { in: wanted.supplier }, branchId: owner } }) : 0,
    wanted.client.length ? prisma.client.count({ where: { id: { in: wanted.client }, branchId: owner } }) : 0,
    wanted.project.length ? prisma.project.count({ where: { id: { in: wanted.project }, branchId: owner } }) : 0,
    wanted.vehicle.length ? prisma.vehicle.count({ where: { id: { in: wanted.vehicle }, branchId: owner } }) : 0,
    wanted.bank.length ? prisma.bank.count({ where: { id: { in: wanted.bank }, branchId: owner } }) : 0,
    wanted.lpo.length ? prisma.lpo.count({ where: { id: { in: wanted.lpo }, branchId: owner } }) : 0,
    wanted.site.length ? prisma.site.count({ where: { id: { in: wanted.site }, project: { branchId: owner } } }) : 0,
    wanted.inventoryItem.length ? prisma.inventoryItem.count({ where: { id: { in: wanted.inventoryItem }, branchId: owner } }) : 0,
    wanted.inventoryVariant.length ? prisma.inventoryVariant.count({ where: { id: { in: wanted.inventoryVariant }, item: { branchId: owner } } }) : 0,
  ]);
  const order = ["supplier", "client", "project", "vehicle", "bank", "lpo", "site", "inventoryItem", "inventoryVariant"] as const;
  return order.every((k, i) => counts[i] === wanted[k].length);
}
