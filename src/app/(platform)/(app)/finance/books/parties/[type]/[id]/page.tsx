import Link from "next/link";
import { notFound } from "next/navigation";
import { Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/PageHeader";
import { getBooksContext } from "../../../books-data";
import { PartyStatement } from "../../statement";

export const metadata = { title: "Statement" };

export default async function PartyLedgerPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const ctx = await getBooksContext();
  const { type: raw, id } = await params;
  const type = raw === "SUPPLIER" ? "SUPPLIER" : raw === "CLIENT" ? "CLIENT" : null;
  if (!type || !ctx.branch || !ctx.initialized) notFound();
  const party = type === "CLIENT" ? await prisma.client.findUnique({ where: { id }, select: { name: true, branchId: true } }) : await prisma.supplier.findUnique({ where: { id }, select: { name: true, branchId: true } });
  if (!party || party.branchId !== ctx.branch.id) notFound();
  return (
    <div className="space-y-5">
      <PageHeader title={party.name} icon={Users} breadcrumbs={[{ label: "Finance", href: "/finance/bills" }, { label: "Accounting", href: "/finance/books" }, { label: type === "CLIENT" ? "Who owes you" : "Who you owe", href: `/finance/books/parties?type=${type}` }, { label: party.name }]} description={`${type === "CLIENT" ? "Client" : "Supplier"} statement`} />
      <PartyStatement type={type} id={id} />
      <Link href={type === "CLIENT" ? `/clients/${id}` : `/suppliers/${id}`} className="text-sm text-muted hover:underline">Open {type === "CLIENT" ? "client" : "supplier"} page</Link>
    </div>
  );
}
