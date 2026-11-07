import type { Metadata } from "next";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "reconcile-site-attendance-timesheets-invoices")!;
const url = `https://manpowersync.com/blog/${post.slug}`;
export const metadata: Metadata = finishMetadata({ title: post.title, description: post.description, alternates: { canonical: url }, robots: { index: true, follow: true }, openGraph: { title: post.title, description: post.description, url, type: "article" } });

export default function Page() {
  return <ContentShell><PostLayout post={post}>
    <p>Reconciliation means checking that site attendance, the hours a client approves and the hours on an invoice agree. They may legitimately differ: an employee can be paid for hours the contract does not allow you to bill. The goal is to identify and explain every difference before the invoice goes out.</p>
    <h2>1. Start with one period and one project</h2>
    <p>Collect the daily attendance records, the roster of workers assigned to the site, the client-approved timesheet and the applicable rate schedule. Confirm the client, project or site, purchase order or LPO reference, and start and end dates. Agree which version of each document is final.</p>
    <h2>2. Match workers and days</h2>
    <p>Use a stable employee ID, not a name alone. Compare each worker&rsquo;s days and hours against the site record. Investigate missing workers, duplicate entries, transfers between sites and overtime entered differently. Keep the original records and record who approved each correction.</p>
    <h2>3. Separate payable hours from billable hours</h2>
    <p>Payroll hours and client-billable hours answer different questions. Check how the contract treats overtime, holidays, travel, standby time and absences. Record the reason for each adjustment and get client approval where the contract requires it. An unsigned adjustment should not silently change an approved timesheet.</p>
    <h2>Worked example</h2>
    <p>Imagine a mason has 200 hours in site attendance. The client-approved timesheet shows 192 hours because eight hours of standby were not billable under the agreed contract. At AED 20 per billable hour, the invoice line is 192 × 20 = <strong>AED 3,840 before tax</strong>. The eight-hour difference remains documented for the payroll and commercial teams to review. This example is illustrative; use your actual contract and rates.</p>
    <h2>4. Compare the invoice to the approved summary</h2>
    <p>Match the worker or trade, project, approved quantity and agreed rate. Recalculate each line, then check contractually permitted additions, deductions and applicable tax. Attach the signed timesheet and other evidence the client requires. Resolve differences before submission rather than sending conflicting documents.</p>
    <h2>Before sending: a short checklist</h2>
    <ul><li>Period, client, site and reference match on all documents.</li><li>Each worker is identified once per relevant assignment and each unexplained difference has an owner.</li><li>Approved hours and contract rates match invoice lines.</li><li>Required approvals and supporting documents are retained securely.</li></ul>
    <p>Start with the free <a href="/tools/construction-timesheet-template">construction timesheet template</a>. For the format and sign-offs, see the <a href="/blog/construction-timesheet-format-labour-supply-uae">labour supply timesheet guide</a>; for recurring disputes, read <a href="/blog/stop-client-timesheet-disputes-labour-supply-invoices">how to prevent client timesheet disputes</a>.</p>
  </PostLayout></ContentShell>;
}
