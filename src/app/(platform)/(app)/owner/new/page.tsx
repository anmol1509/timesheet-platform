import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireOwner } from "@/lib/ownerServer";
import { NewCustomerForm, RegisterExistingForm } from "./forms";

export const metadata = { title: "Add customer" };

export default async function NewCustomerPage() {
  await requireOwner();
  const [branches, linked] = await Promise.all([
    prisma.branch.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
    prisma.customer.findMany({ where: { branchId: { not: null } }, select: { branchId: true } }),
  ]);
  const linkedIds = new Set(linked.map((l) => l.branchId));
  return (
    <div className="form-comfy space-y-6">
      <Link href="/owner" className="inline-flex items-center gap-1 text-sm text-muted hover:text-primary"><ArrowLeft className="h-4 w-4" aria-hidden />Customers</Link>
      <NewCustomerForm templates={branches} defaultTemplate={branches.find((b) => b.code === "MAIN")?.id ?? ""} />
      {branches.some((b) => !linkedIds.has(b.id)) && <RegisterExistingForm branches={branches.filter((b) => !linkedIds.has(b.id))} />}
    </div>
  );
}
