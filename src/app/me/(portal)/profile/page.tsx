import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getEssEmployee } from "@/lib/ess/session";
import { PROFILE_FIELDS } from "@/lib/ess/profileFields";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "My details" };

const mask = (v: string) => (v.length > 4 ? `${"•".repeat(Math.min(v.length - 4, 8))}${v.slice(-4)}` : v);
const show = (v: unknown, masked?: boolean) => {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v);
  if (s === "MALE" || s === "FEMALE") return s.charAt(0) + s.slice(1).toLowerCase();
  return masked ? mask(s) : s;
};

export default async function ProfilePage() {
  const me = await getEssEmployee();
  if (!me) redirect("/me/login");
  const e = (await prisma.employee.findUnique({ where: { id: me.id } })) as Record<string, unknown> | null;
  if (!e) redirect("/me/login");
  const has = (k: string) => e[k] !== null && e[k] !== undefined && String(e[k]).trim() !== "";
  const missing = PROFILE_FIELDS.filter((f) => !has(f.key));
  const onFile = PROFILE_FIELDS.filter((f) => has(f.key));

  return (
    <>
      <section className="card p-5">
        <h1 className="text-xl font-semibold tracking-tight text-primary">My details</h1>
        <p className="mt-1 text-sm text-secondary">
          {missing.length > 0 ? `${missing.length} detail${missing.length === 1 ? " is" : "s are"} missing from your record. Please add what you can.` : "Your record is complete. Thank you."}
        </p>
      </section>
      {missing.length > 0 && <ProfileForm missing={missing} />}
      {onFile.length > 0 && (
        <section className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-primary">On file</h2>
          <dl className="divide-y divide-[var(--border)] text-sm">
            {onFile.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3 py-2">
                <dt className="text-muted">{f.label}</dt>
                <dd className="tabular text-primary">{show(e[f.key], f.mask)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">To change something already on file, please ask your supervisor.</p>
        </section>
      )}
    </>
  );
}
