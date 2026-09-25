"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { createCandidateAction, updateCandidateAction } from "./actions";

type Option = { id: string; name: string };
type DemandOption = { id: string; requestNo: number; project: { name: string } };
type Candidate = {
  id: string;
  candidateName: string;
  trade: string | null;
  nationality: string | null;
  sponsorCompany: string | null;
  joiningTargetDate: Date | null;
  agencyId: string | null;
  demandRequestId: string | null;
  projectId: string | null;
  assignedHrId: string | null;
  remarks: string | null;
};
type State = { error: string | null; ok?: boolean };

function Feedback({ state }: { state: State }) {
  if (state.error) return <p role="alert" className="text-sm text-[var(--error)]">{state.error}</p>;
  return null;
}

function toDateInput(d: Date | null) {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

const label = "mb-1 block text-xs font-medium text-muted";

export function CandidateForm({
  candidate,
  agencies,
  projects,
  demandRequests,
  hrUsers,
}: {
  candidate?: Candidate;
  agencies: Option[];
  projects: (Option & { code: string })[];
  demandRequests: DemandOption[];
  hrUsers: Option[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (_prev: State, fd: FormData) => {
      if (candidate) fd.set("id", candidate.id);
      const res = await (candidate ? updateCandidateAction : createCandidateAction)({ error: null }, fd);
      if (res?.ok) router.refresh();
      return res ?? { error: null };
    },
    { error: null } as State
  );

  return (
    <form action={action} className="card max-w-3xl space-y-4 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Candidate name *</span>
          <input name="candidateName" defaultValue={candidate?.candidateName} required className="input w-full" />
        </label>
        <label className="block">
          <span className={label}>Trade</span>
          <input name="trade" defaultValue={candidate?.trade ?? ""} className="input w-full" />
        </label>
        <label className="block">
          <span className={label}>Nationality</span>
          <input name="nationality" defaultValue={candidate?.nationality ?? ""} className="input w-full" />
        </label>
        <label className="block">
          <span className={label}>Sponsor company</span>
          <input name="sponsorCompany" defaultValue={candidate?.sponsorCompany ?? ""} className="input w-full" />
        </label>
        <label className="block">
          <span className={label}>Target joining date</span>
          <input type="date" name="joiningTargetDate" defaultValue={toDateInput(candidate?.joiningTargetDate ?? null)} className="input w-full" />
        </label>
        <label className="block">
          <span className={label}>Agency</span>
          <Select
            name="agencyId"
            defaultValue={candidate?.agencyId ?? ""}
            searchable
            options={[{ value: "", label: "None" }, ...agencies.map((a) => ({ value: a.id, label: a.name }))]}
          />
        </label>
        <label className="block">
          <span className={label}>Project</span>
          <Select
            name="projectId"
            defaultValue={candidate?.projectId ?? ""}
            searchable
            options={[{ value: "", label: "None" }, ...projects.map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }))]}
          />
        </label>
        <label className="block">
          <span className={label}>Labour request (LR)</span>
          <Select
            name="demandRequestId"
            defaultValue={candidate?.demandRequestId ?? ""}
            searchable
            options={[{ value: "", label: "None" }, ...demandRequests.map((d) => ({ value: d.id, label: `#${d.requestNo} · ${d.project.name}` }))]}
          />
        </label>
        <label className="block">
          <span className={label}>Assigned HR</span>
          <Select
            name="assignedHrId"
            defaultValue={candidate?.assignedHrId ?? ""}
            searchable
            options={[{ value: "", label: "Unassigned" }, ...hrUsers.map((u) => ({ value: u.id, label: u.name }))]}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Remarks</span>
          <textarea name="remarks" defaultValue={candidate?.remarks ?? ""} rows={3} className="input w-full" />
        </label>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : candidate ? "Save changes" : "Add candidate"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
