import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { EditClientForm } from "./edit-form";
import { ClientContacts } from "./client-contacts";
import { ClientTradeRates } from "./client-trade-rates";
import { ClientDocuments } from "./client-documents";
import { deleteClientAction } from "../actions";
import { requireUserWithBranch } from "@/lib/auth";
import { isOutsideBranch } from "@/lib/branch";

function toDateInput(d: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { branchId, isSuperAdmin } = await requireUserWithBranch();
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      projects: { orderBy: { name: "asc" } },
      contacts: { orderBy: { name: "asc" } },
      tradeRates: { orderBy: { trade: "asc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!client || isOutsideBranch(client.branchId, branchId, isSuperAdmin)) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clients" className="text-sm text-muted hover:underline">
          ← Clients
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl tracking-tight text-primary font-semibold">
              {client.name}
            </h1>
            <Badge color={client.status === "ACTIVE" ? "green" : "slate"}>
              {client.status}
            </Badge>
          </div>
          <DeleteButton
            action={deleteClientAction}
            hiddenFields={{ clientId: client.id }}
            confirmMessage={`Delete ${client.name}? This only works if no timesheet rows or projects are linked to it.`}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          />
        </div>
        <p className="mt-1 text-sm text-muted">
          {client.code || "No code assigned"}
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {/* Documents lead here as they do in the add-employee wizard: a trade
          licence carries an expiry that stops work, and it used to sit below a
          49-field form where nobody scrolled to it. */}
      <ClientDocuments clientId={client.id} documents={client.documents} />

      <EditClientForm
        client={{
          id: client.id,
          contactPerson: client.contactPerson,
          contactEmail: client.contactEmail,
          contactPhone: client.contactPhone,
          basicRate: client.basicRate,
          hourlyRate: client.hourlyRate,
          contractStart: toDateInput(client.contractStart),
          contractEnd: toDateInput(client.contractEnd),
          status: client.status,
          trn: client.trn,
          tradeLicenseNumber: client.tradeLicenseNumber,
          tradeLicenseExpiry: toDateInput(client.tradeLicenseExpiry),
          billingAddress: client.billingAddress,
          paymentTerms: client.paymentTerms,
          retentionPercent: client.retentionPercent,
          secondContactName: client.secondContactName,
          secondContactPhone: client.secondContactPhone,
          secondContactEmail: client.secondContactEmail,
          country: client.country,
          emirate: client.emirate,
          website: client.website,
          fax: client.fax,
          poBox: client.poBox,
          paymentSchedule: client.paymentSchedule,
          account: client.account,
          vendorCode: client.vendorCode,
          customer: client.customer,
          currency: client.currency,
          grades: client.grades,
          telephone: client.telephone,
        }}
      />

      <ClientContacts clientId={client.id} contacts={client.contacts} />

      <ClientTradeRates clientId={client.id} rates={client.tradeRates} />


      <section>
        <h2 className="mb-3 text-sm font-semibold text-primary">Projects</h2>
        {client.projects.length === 0 ? (
          <p className="empty-state py-8 text-sm text-muted">
            No projects for this client yet.{" "}
            <Link href="/projects/new" className="underline">
              Add one
            </Link>
            .
          </p>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-[var(--border)]">
                {client.projects.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-primary">
                      <Link href={`/projects/${p.id}`}>{p.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.code}</td>
                    <td className="px-4 py-3">
                      <Badge color={p.status === "ACTIVE" ? "green" : "amber"}>
                        {p.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
