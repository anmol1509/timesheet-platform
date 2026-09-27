import type { Metadata } from "next";
import { ContentShell } from "@/app/welcome/content-shell";
import { GuideLayout } from "../guide-layout";
import { GUIDES } from "../guides-data";

const guide = GUIDES.find((g) => g.slug === "setting-up-roles-permissions")!;
const URL = `https://manpowersync.com/guides/${guide.slug}`;

export const metadata: Metadata = {
  title: guide.title,
  description: guide.description,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: { title: guide.title, description: guide.description, url: URL, type: "article" },
};

export default function Page() {
  return (
    <ContentShell>
      <GuideLayout guide={guide}>
        <h2>The three base roles</h2>
        <ul>
          <li><strong>Super admin</strong> &mdash; sees and manages every branch, for whoever owns the account.</li>
          <li><strong>Branch admin</strong> &mdash; full rights, scoped to their own branch only.</li>
          <li><strong>Staff</strong> &mdash; scoped to their own branch, and further limited to whatever an access role grants them.</li>
        </ul>
        <p>
          A branch admin or staff member can never see or act on another branch&rsquo;s employees,
          documents or financial records &mdash; that scoping is enforced everywhere, not just hidden
          in the interface.
        </p>

        <h2>Building a custom access role for staff</h2>
        <p>
          For staff members, access is set per module and per action &mdash; view, create, edit,
          delete, approve, export &mdash; across areas like workforce, projects, demand, payroll and
          finance. A role only needs the actions a person&rsquo;s job actually requires: someone in
          operations might get view and edit on workforce and projects, without touching payroll or
          finance at all.
        </p>
        <p>
          One rule worth knowing: granting any other action on a module (create, edit, approve)
          always requires View on that same module too &mdash; you can&rsquo;t edit what you&rsquo;re not
          allowed to see.
        </p>

        <h2>Who can approve what</h2>
        <p>
          The Approvals inbox only ever shows a person the kinds of request their own permissions
          allow &mdash; expenses, bills, payroll, worker or supplier changes, demand requests,
          timesheets and attendance corrections are each tied to a specific module and action, so
          &ldquo;who can approve this&rdquo; is answered by the same role setup, not a separate
          configuration.
        </p>

        <h2>A role, saved once, reused for the next hire</h2>
        <p>
          An access role is created once with a name (&ldquo;Site Supervisor&rdquo;, &ldquo;Finance
          Clerk&rdquo;) and can be assigned to any number of people afterward &mdash; the next person
          hired into the same job gets the same access in one step, rather than rebuilding the
          permission set from scratch.
        </p>
      </GuideLayout>
    </ContentShell>
  );
}
