"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, IdCard, Building2, MessageSquareText } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { PhoneField } from "@/components/ui/PhoneField";
import { TRADES } from "@/lib/trades";
import { ContactPicker, type AgencyContactOption } from "./contact-picker";
import { AgencyPicker, type AgencyOption } from "./agency-picker";
import { createCandidateAction, updateCandidateAction } from "./actions";

const TRADE_OPTIONS = [{ value: "", label: "Not set" }, ...TRADES.map((t) => ({ value: t, label: t }))];

type Option = { id: string; name: string };
type DemandOption = { id: string; requestNo: number; project: { name: string } };
type Candidate = {
  id: string;
  candidateName: string;
  trade: string | null;
  nationality: string | null;
  sponsorCompany: string | null;
  joiningTargetDate: Date | null;
  phone: string | null;
  email: string | null;
  passportNumber: string | null;
  emiratesId: string | null;
  dateOfBirth: Date | null;
  gender: string | null;
  bloodGroup: string | null;
  agencyId: string | null;
  agencyContactId: string | null;
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
const GENDER_OPTIONS = [{ value: "", label: "Not set" }, { value: "MALE", label: "Male" }, { value: "FEMALE", label: "Female" }];
const BLOOD_OPTIONS = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((v) => ({ value: v, label: v || "Not set" }));

function SectionHead({ icon: Icon, title, hint }: { icon: React.ElementType; title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2 border-b border-default pb-2">
      <Icon className="h-4 w-4 text-subtle" aria-hidden />
      <span className="text-sm font-medium text-primary">{title}</span>
      {hint && <span className="text-xs text-muted">— {hint}</span>}
    </div>
  );
}

export function CandidateForm({
  candidate,
  agencies,
  agencyContacts,
  projects,
  demandRequests,
  hrUsers,
}: {
  candidate?: Candidate;
  agencies: AgencyOption[];
  agencyContacts: AgencyContactOption[];
  projects: (Option & { code: string })[];
  demandRequests: DemandOption[];
  hrUsers: Option[];
}) {
  const router = useRouter();
  const [agencyId, setAgencyId] = useState(candidate?.agencyId ?? "");
  const [agencyList, setAgencyList] = useState(agencies);
  const [agencyContactId, setAgencyContactId] = useState(candidate?.agencyContactId ?? "");
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
    <form action={action} className="card max-w-3xl space-y-6 p-5">
      <section>
        <SectionHead icon={UserRound} title="Profile" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Candidate name *</span>
            <input name="candidateName" defaultValue={candidate?.candidateName} required className="input w-full" />
          </label>
          <label className="block">
            <span className={label}>Trade</span>
            <Select name="trade" defaultValue={candidate?.trade ?? ""} searchable options={TRADE_OPTIONS} />
          </label>
          <label className="block">
            <span className={label}>Nationality</span>
            <CountrySelect name="nationality" defaultValue={candidate?.nationality ?? ""} />
          </label>
          <label className="block">
            <span className={label}>Date of birth</span>
            <DatePicker name="dateOfBirth" defaultValue={toDateInput(candidate?.dateOfBirth ?? null)} className="w-full" />
          </label>
          <label className="block">
            <span className={label}>Gender</span>
            <Select name="gender" defaultValue={candidate?.gender ?? ""} searchable={false} options={GENDER_OPTIONS} />
          </label>
          <label className="block">
            <span className={label}>Blood group</span>
            <Select name="bloodGroup" defaultValue={candidate?.bloodGroup ?? ""} searchable={false} options={BLOOD_OPTIONS} />
          </label>
          <label className="block">
            <span className={label}>Phone</span>
            <PhoneField name="phone" defaultValue={candidate?.phone} />
          </label>
          <label className="block">
            <span className={label}>Email</span>
            <input name="email" type="email" defaultValue={candidate?.email ?? ""} className="input w-full" />
          </label>
        </div>
      </section>

      <section>
        <SectionHead icon={IdCard} title="Identity documents" hint="required before this candidate can be marked joined" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Passport number</span>
            <input name="passportNumber" defaultValue={candidate?.passportNumber ?? ""} className="input w-full" />
          </label>
          <label className="block">
            <span className={label}>Emirates ID</span>
            <input name="emiratesId" defaultValue={candidate?.emiratesId ?? ""} className="input w-full" />
          </label>
        </div>
      </section>

      <section>
        <SectionHead icon={Building2} title="Assignment" />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={label}>Agency</span>
            <AgencyPicker
              name="agencyId"
              agencies={agencyList}
              value={agencyId}
              onChange={(id, list) => {
                setAgencyId(id);
                setAgencyList(list);
                setAgencyContactId("");
              }}
            />
          </label>
          <label className="block">
            <span className={label}>Agency contact</span>
            <ContactPicker
              name="agencyContactId"
              agencyId={agencyId}
              contacts={agencyContacts}
              value={agencyContactId}
              onChange={(id) => setAgencyContactId(id)}
            />
          </label>
          <label className="block">
            <span className={label}>Sponsor company</span>
            <input name="sponsorCompany" defaultValue={candidate?.sponsorCompany ?? ""} className="input w-full" />
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
            <span className={label}>Target joining date</span>
            <DatePicker name="joiningTargetDate" defaultValue={toDateInput(candidate?.joiningTargetDate ?? null)} className="w-full" />
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
        </div>
      </section>

      <section>
        <SectionHead icon={MessageSquareText} title="Notes" />
        <label className="block">
          <span className={label}>Remarks</span>
          <textarea name="remarks" defaultValue={candidate?.remarks ?? ""} rows={3} className="input w-full" />
        </label>
      </section>

      <div className="flex items-center gap-3 border-t border-default pt-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : candidate ? "Save changes" : "Add candidate"}
        </button>
        <Feedback state={state} />
      </div>
    </form>
  );
}
