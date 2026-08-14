"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { createRouteAction, updateRouteAction } from "./actions";

type Vehicle = { id: string; plateNumber: string };
type Project = { id: string; name: string; code: string };
type StopRow = { id: string; location: string; pickupTime: string; notes: string };

function blankStopRow(): StopRow {
  return { id: crypto.randomUUID(), location: "", pickupTime: "", notes: "" };
}

export function RouteForm({
  vehicles,
  projects,
  route,
  initialVehicleId,
}: {
  vehicles: Vehicle[];
  projects: Project[];
  route?: {
    id: string;
    name: string;
    vehicleId: string;
    projectId: string | null;
    stops: { location: string; pickupTime: string | null; notes: string | null }[];
  };
  initialVehicleId?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(route?.name ?? "");
  const [vehicleId, setVehicleId] = useState(route?.vehicleId ?? initialVehicleId ?? "");
  const [projectId, setProjectId] = useState(route?.projectId ?? "");
  const [stops, setStops] = useState<StopRow[]>(
    route && route.stops.length > 0
      ? route.stops.map((s) => ({
          id: crypto.randomUUID(),
          location: s.location,
          pickupTime: s.pickupTime ?? "",
          notes: s.notes ?? "",
        }))
      : [blankStopRow()]
  );

  function updateStop(id: string, patch: Partial<StopRow>) {
    setStops((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function moveStop(index: number, direction: -1 | 1) {
    setStops((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleSubmit() {
    if (!name || !vehicleId) return;
    const formData = new FormData();
    if (route) formData.append("routeId", route.id);
    formData.append("name", name);
    formData.append("vehicleId", vehicleId);
    formData.append("projectId", projectId);
    formData.append(
      "stopsJson",
      JSON.stringify(
        stops
          .filter((s) => s.location.trim())
          .map((s) => ({
            location: s.location.trim(),
            pickupTime: s.pickupTime || null,
            notes: s.notes || null,
          }))
      )
    );
    startTransition(() => {
      if (route) {
        updateRouteAction(formData);
      } else {
        createRouteAction(formData);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-muted">Route Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Morning Pickup — Al Ain Road"
            className="input w-full"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Vehicle</span>
          <Select
            value={vehicleId}
            onChange={setVehicleId}
            placeholder="Select vehicle"
            options={vehicles.map((v) => ({ value: v.id, label: v.plateNumber }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Project (optional)</span>
          <Select
            value={projectId}
            onChange={setProjectId}
            placeholder="Not set"
            options={projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          />
        </label>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-primary">Stops</h2>
        <div className="space-y-2">
          {stops.map((s, i) => (
            <div key={s.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_1fr_auto]">
              <input
                value={s.location}
                onChange={(e) => updateStop(s.id, { location: e.target.value })}
                placeholder="Location"
                className="input"
              />
              <input
                value={s.pickupTime}
                onChange={(e) => updateStop(s.id, { pickupTime: e.target.value })}
                placeholder="07:30"
                className="input"
              />
              <input
                value={s.notes}
                onChange={(e) => updateStop(s.id, { notes: e.target.value })}
                placeholder="Notes"
                className="input"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveStop(i, -1)}
                  disabled={i === 0}
                  className="rounded-lg border border-strong px-2 py-2 text-xs text-secondary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveStop(i, 1)}
                  disabled={i === stops.length - 1}
                  className="rounded-lg border border-strong px-2 py-2 text-xs text-secondary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setStops((prev) => prev.filter((r) => r.id !== s.id))}
                  disabled={stops.length === 1}
                  className="rounded-lg border border-red-200 px-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setStops((prev) => [...prev, blankStopRow()])}
          className="btn btn-secondary btn-sm mt-3"
        >
          + Add stop
        </button>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !name || !vehicleId}
        className="btn btn-primary"
      >
        {pending ? "Saving…" : route ? "Save changes" : "Create Route"}
      </button>
    </div>
  );
}
