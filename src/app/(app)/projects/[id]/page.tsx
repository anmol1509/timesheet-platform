import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/Badge";
import type { BadgeColor } from "@/components/Badge";
import { DeleteButton } from "@/components/DeleteButton";
import { EditProjectForm } from "./edit-form";
import { ProjectLocation } from "./project-location";
import { ProjectOtherDetails } from "./project-other-details";
import { ProjectDocuments } from "./project-documents";
import { ProjectTradeRates } from "./project-trade-rates";
import { ProjectHolidays } from "./project-holidays";
import { ProjectContacts } from "./project-contacts";
import { ProjectInventory } from "./project-inventory";
import { ProjectTabs } from "./project-tabs";
import { deleteProjectAction } from "../actions";

const STATUS_COLOR: Record<string, BadgeColor> = {
  ACTIVE: "green",
  PLANNING: "amber",
  COMPLETED: "slate",
  ON_HOLD: "red",
};

function toDateInput(d: Date | null) {
  if (!d) return "";
  return new Date(d).toISOString().slice(0, 10);
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [project, sites, clients, inventoryCatalog] = await Promise.all([
    prisma.project.findUnique({
      where: { id },
      include: {
        client: true,
        employees: true,
        site: true,
        documents: { orderBy: { uploadedAt: "desc" } },
        tradeRates: { where: { projectId: id }, orderBy: { trade: "asc" } },
        holidays: { orderBy: { date: "asc" } },
        contacts: { orderBy: { name: "asc" } },
        inventory: { include: { item: true }, orderBy: { assignedDate: "desc" } },
      },
    }),
    prisma.site.findMany({ orderBy: { name: "asc" } }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.inventoryItem.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!project) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/projects" className="text-sm text-slate-500 hover:underline">
          ← Projects
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              {project.name}
            </h1>
            <Badge color={STATUS_COLOR[project.status] || "slate"}>
              {project.status.replace("_", " ").toLowerCase()}
            </Badge>
          </div>
          <DeleteButton
            action={deleteProjectAction}
            hiddenFields={{ projectId: project.id }}
            confirmMessage={
              project.employees.length > 0
                ? `Delete ${project.name}? ${project.employees.length} employee(s) will be unassigned from it.`
                : `Delete ${project.name}?`
            }
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
          />
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {project.code} · {project.client.name} ·{" "}
          {project.employees.length} employees assigned
        </p>
      </div>

      <ProjectTabs
        tabs={[
          {
            id: "basic",
            label: "Basic Detail",
            content: (
              <EditProjectForm
                project={{
                  id: project.id,
                  name: project.name,
                  clientId: project.clientId,
                  manager: project.manager,
                  projectCoordinator: project.projectCoordinator,
                  timelineStart: toDateInput(project.timelineStart),
                  timelineEnd: toDateInput(project.timelineEnd),
                  status: project.status,
                  clientProjectNo: project.clientProjectNo,
                  jobType: project.jobType,
                  mainContractor: project.mainContractor,
                  paymentType: project.paymentType,
                  lpoNo: project.lpoNo,
                  lpoDate: toDateInput(project.lpoDate),
                  closedLpo: project.closedLpo,
                  sponsorshipCompany: project.sponsorshipCompany,
                  salesExecutive: project.salesExecutive,
                  contactNo: project.contactNo,
                  timesheetCollectionDate: toDateInput(project.timesheetCollectionDate),
                  noOfEmployeesRequired: project.noOfEmployeesRequired,
                  dayShiftStart: project.dayShiftStart,
                  dayShiftEnd: project.dayShiftEnd,
                  nightShiftStart: project.nightShiftStart,
                  nightShiftEnd: project.nightShiftEnd,
                  interTransfer: project.interTransfer,
                  internalUse: project.internalUse,
                }}
                clients={clients.map((c) => ({ id: c.id, name: c.name }))}
              />
            ),
          },
          {
            id: "documents",
            label: "Documents",
            content: <ProjectDocuments projectId={project.id} documents={project.documents} />,
          },
          {
            id: "rates",
            label: "Approved Rates",
            content: (
              <ProjectTradeRates
                projectId={project.id}
                clientId={project.clientId}
                clientName={project.client.name}
                rates={project.tradeRates}
              />
            ),
          },
          {
            id: "holidays",
            label: "Holiday Details",
            content: <ProjectHolidays projectId={project.id} holidays={project.holidays} />,
          },
          {
            id: "location",
            label: "Location Details",
            content: (
              <ProjectLocation
                projectId={project.id}
                siteId={project.siteId}
                address={project.address}
                latitude={project.latitude}
                longitude={project.longitude}
                sites={sites.map((s) => ({ id: s.id, name: s.name }))}
              />
            ),
          },
          {
            id: "other",
            label: "Other Details",
            content: (
              <ProjectOtherDetails projectId={project.id} description={project.description} />
            ),
          },
          {
            id: "contacts",
            label: "Related Users",
            content: <ProjectContacts projectId={project.id} contacts={project.contacts} />,
          },
          {
            id: "inventory",
            label: "Inventory Details",
            content: (
              <ProjectInventory
                projectId={project.id}
                assignments={project.inventory}
                catalog={inventoryCatalog.map((i) => i.name)}
              />
            ),
          },
        ]}
      />

      {project.employees.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Assigned employees
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {project.employees.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      <Link href={`/employees/${e.id}`}>{e.name}</Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {e.employeeIdNo}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.trade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
