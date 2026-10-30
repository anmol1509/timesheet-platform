"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { UserRound, IdCard, Building2, MessageSquareText } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { DatePicker } from "@/components/ui/DatePicker";
import { PhoneField } from "@/components/ui/PhoneField";
import { TRADES } from "@/lib/trades";
import { CANDIDATE_TYPES } from "@/lib/onboarding";
import { ContactPicker, type AgencyContactOption } from "./contact-picker";
import { AgencyPicker, type AgencyOption } from "./agency-picker";
import { createCandidateAction, updateCandidateAction } from "./actions";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/Alert";
const TRADE_OPTIONS = [{ value: "", label: "Not set" }, ...TRADES.map((t) => ({ value: t, label: t }))];

type Option = { id: string; name: string };
type DemandOption = { id: string; requestNo: number; project: { name: string } };
type Candidate = {
  id: string;
  candidateName: string;
  trade: string | null;
  nationality: string | null;
  sponsorCompany: string | null;
  sponsorSupplierId?: string | null;
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
  candidateType?: string;
};
type State = { error: string | null; ok?: boolean };

function Feedback({ state, saved }: { state: State; saved?: boolean }) {
  if (state.error) return <Alert>{state.error}</Alert>;
  if (saved && state.ok) return <p role="status" className="text-sm text-[var(--success)]">Saved.</p>;
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
  sponsors,
  agencies,
  agencyContacts,
  projects,
  demandRequests,
  hrUsers,
  readOnly = false,
}: {
  candidate?: Candidate;
  /** Your own companies: the only ones that can sponsor a hire. */
  sponsors: Option[];
  agencies: AgencyOption[];
  agencyContacts: AgencyContactOption[];
  projects: (Option & { code: string })[];
  demandRequests: DemandOption[];
  hrUsers: Option[];
  /** A person who may only look: every field is disabled and there is nothing to save. */
  readOnly?: boolean;
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
    <form action={action} className="card w-full max-w-6xl min-w-0 space-y-8 p-8">
      <fieldset disabled={readOnly} className="min-w-0 space-y-6 border-0 p-0">
      <section>
        <SectionHead icon={UserRound} title="Profile" />
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className={label}>Type of hire</span>
            <Select name="candidateType" defaultValue={candidate?.candidateType ?? "OVERSEAS"} searchable={false} options={CANDIDATE_TYPES.map((t) => ({ value: t.value, label: `${t.label}: ${t.hint}` }))} />
          </label>
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
        <SectionHead icon={IdCard} title="Identity documents" hint="the passport number is needed before this candidate can be added as an employee; the Emirates ID can come later" />
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
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
        <div className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-3">
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
            <span className={label}>Sponsor company <span className="font-normal">(your own company)</span></span>
            <Select
              name="sponsorSupplierId"
              defaultValue={candidate?.sponsorSupplierId ?? ""}
              searchable
              emptyText="No own companies yet. Add one under My Companies."
              options={[{ value: "", label: "Not set" }, ...sponsors.map((c) => ({ value: c.id, label: c.name }))]}
            />
            {candidate?.sponsorCompany && !candidate.sponsorSupplierId && (
              <span className="mt-1 block text-xs text-[var(--warning)]">Earlier entry &ldquo;{candidate.sponsorCompany}&rdquo; didn&rsquo;t match one of your companies. Choose it from the list.</span>
            )}
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

      {!readOnly && (
        <div className="flex items-center gap-3 border-t border-default pt-4">
          <Button size="btn" type="submit" disabled={pending} loading={pending}>
            {candidate ? "Save changes" : "Add candidate"}
          </Button>
          <Feedback state={state} saved={!!candidate} />
        </div>
      )}
      </fieldset>
    </form>
  );
}
