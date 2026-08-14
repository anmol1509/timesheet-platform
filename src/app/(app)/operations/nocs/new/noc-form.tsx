"use client";

import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { NOC_DISPLAY_FIELDS, DEFAULT_NOC_DISPLAY_FIELDS } from "@/lib/nocDisplayFields";
import { createNocAction } from "../actions";

type RequestOption = {
  id: string;
  requestNo: number;
  clientName: string;
  projectName: string;
  employees: { id: string; name: string; employeeIdNo: string }[];
};

export function NocForm({
  requests,
  templates,
  initialDemandRequestId,
}: {
  requests: RequestOption[];
  templates: { id: string; name: string }[];
  initialDemandRequestId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [demandRequestId, setDemandRequestId] = useState(initialDemandRequestId);
  const [templateId, setTemplateId] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [displayFields, setDisplayFields] = useState<Set<string>>(new Set(DEFAULT_NOC_DISPLAY_FIELDS));
  const [mobilizeDate, setMobilizeDate] = useState("");
  const [remarks, setRemarks] = useState("");

  const selectedRequest = requests.find((r) => r.id === demandRequestId);
  const availableEmployees = selectedRequest?.employees ?? [];

  function selectRequest(id: string) {
    setDemandRequestId(id);
    setSelectedEmployees(new Set());
  }

  function toggleEmployee(id: string) {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleField(key: string) {
    setDisplayFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleSubmit() {
    if (!demandRequestId || !templateId || selectedEmployees.size === 0) return;
    const formData = new FormData();
    formData.append("demandRequestId", demandRequestId);
    formData.append("templateId", templateId);
    for (const id of selectedEmployees) formData.append("employeeId", id);
    formData.append("displayFields", [...displayFields].join(","));
    formData.append("mobilizeDate", mobilizeDate);
    formData.append("remarks", remarks);
    startTransition(() => {
      createNocAction(formData);
    });
  }

  return (
    <div className="space-y-6">
      <div className="card grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Demand Request</span>
          <Select
            value={demandRequestId}
            onChange={selectRequest}
            placeholder="Select demand request"
            options={requests.map((r) => ({
              value: r.id,
              label: `#${r.requestNo} — ${r.clientName} / ${r.projectName}`,
            }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Letter Template</span>
          <Select
            value={templateId}
            onChange={setTemplateId}
            placeholder="Select template"
            options={templates.map((t) => ({ value: t.id, label: t.name }))}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Mobilize Date</span>
          <input
            type="date"
            value={mobilizeDate}
            onChange={(e) => setMobilizeDate(e.target.value)}
            className="input w-full"
          />
        </label>
        <div className="sm:col-span-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Remarks</span>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              className="input w-full"
            />
          </label>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-primary">Employees</h2>
        {!demandRequestId ? (
          <p className="text-sm text-muted">Select a demand request first.</p>
        ) : availableEmployees.length === 0 ? (
          <p className="text-sm text-muted">This request has no allocated employees yet.</p>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-default p-2">
            {availableEmployees.map((e) => (
              <label
                key={e.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-hover"
                onClick={(ev) => {
                  ev.preventDefault();
                  toggleEmployee(e.id);
                }}
              >
                <Checkbox checked={selectedEmployees.has(e.id)} />
                <span className="flex-1 truncate">
                  {e.name} ({e.employeeIdNo})
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-primary">Display Fields</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NOC_DISPLAY_FIELDS.map((f) => (
            <label
              key={f.key}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-hover"
              onClick={(ev) => {
                ev.preventDefault();
                toggleField(f.key);
              }}
            >
              <Checkbox checked={displayFields.has(f.key)} />
              <span>{f.label}</span>
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={pending || !demandRequestId || !templateId || selectedEmployees.size === 0}
        className="btn btn-primary"
      >
        {pending ? "Generating…" : "Create NOC"}
      </button>
    </div>
  );
}
