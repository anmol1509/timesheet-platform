"use client";

import { useState } from "react";
import { addVehicleProjectAction, removeVehicleProjectAction } from "../actions";
import { Select } from "@/components/ui/Select";
import { DeleteButton } from "@/components/DeleteButton";

type Project = { id: string; name: string; code: string };

export function ProjectRoutes({
  vehicleId,
  assignedProjects,
  allProjects,
}: {
  vehicleId: string;
  assignedProjects: Project[];
  allProjects: Project[];
}) {
  const [selected, setSelected] = useState("");
  const assignedIds = new Set(assignedProjects.map((p) => p.id));
  const available = allProjects.filter((p) => !assignedIds.has(p.id));

  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-primary">
        Projects serviced
      </h2>
      <div className="card p-5">
        {assignedProjects.length === 0 ? (
          <p className="text-sm text-muted">
            Not linked to any project yet.
          </p>
        ) : (
          <ul className="mb-4 space-y-2">
            {assignedProjects.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-default bg-surface-subtle px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium text-primary">{p.name}</span>{" "}
                  <span className="text-subtle">{p.code}</span>
                </span>
                <DeleteButton
                  action={removeVehicleProjectAction}
                  hiddenFields={{ vehicleId, projectId: p.id }}
                  confirmMessage={`Remove "${p.name}" from this vehicle's serviced projects?`}
                  label="Remove"
                />
              </li>
            ))}
          </ul>
        )}

        {available.length > 0 && (
          <form
            action={async (formData) => {
              await addVehicleProjectAction(formData);
              setSelected("");
            }}
            className="flex flex-wrap items-end gap-3"
          >
            <input type="hidden" name="vehicleId" value={vehicleId} />
            <label className="block flex-1 min-w-[200px]">
              <span className="mb-1 block text-xs font-medium text-muted">
                Add a project
              </span>
              <Select
                name="projectId"
                value={selected}
                onChange={setSelected}
                placeholder="Select a project"
                options={available.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
              />
            </label>
            <button
              type="submit"
              disabled={!selected}
              className="btn btn-primary"
            >
              Add
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
