import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { EditClientForm } from "./edit-form";
import { deleteClientAction } from "../actions";

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
  const client = await prisma.client.findUnique({
    where: { id },
    include: { projects: { orderBy: { name: "asc" } } },
  });
  if (!client) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/clients" className="text-sm text-slate-500 hover:underline">
          ← Clients
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
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
        <p className="mt-1 text-sm text-slate-500">
          {client.code || "No code assigned"}
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

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
        }}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Projects</h2>
        {client.projects.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
            No projects for this client yet.{" "}
            <Link href="/projects/new" className="underline">
              Add one
            </Link>
            .
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {client.projects.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/projects/${p.id}`}>{p.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.code}</td>
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
