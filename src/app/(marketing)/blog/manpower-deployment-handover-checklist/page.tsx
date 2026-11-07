import type { Metadata } from "next";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "manpower-deployment-handover-checklist")!;
const url = `https://manpowersync.com/blog/${post.slug}`;
export const metadata: Metadata = finishMetadata({ title: post.title, description: post.description, alternates: { canonical: url }, robots: { index: true, follow: true }, openGraph: { title: post.title, description: post.description, url, type: "article" } });

export default function Page() {
  return <ContentShell><PostLayout post={post}>
    <p>A deployment handover connects an approved manpower request with the people who actually arrive at the client&rsquo;s site. A short, shared checklist helps operations, the camp team, transport and the site supervisor work from the same plan.</p>
    <h2>Confirm the request</h2>
    <ul><li>Client, project, site address and contact person.</li><li>Approved trades, headcount, required start date, shift and expected duration.</li><li>Any agreed arrival, induction, safety and site-access requirements.</li><li>The purchase order or contract reference and the person authorised to approve changes.</li></ul>
    <h2>Check the worker list and documents</h2>
    <p>Assign available workers to the correct project and trade using an employee ID. Confirm each person is eligible and available for the assignment, and check the documents and training the client requires. Follow applicable UAE rules and the client&rsquo;s current requirements; a checklist cannot establish work authorisation by itself. Share personal documents only with authorised recipients through approved channels.</p>
    <h2>Arrange travel and accommodation</h2>
    <p>Record the pickup point, time, vehicle or transport contact, and destination. If accommodation is provided, confirm the camp, room or bed and check-in contact. Tell the worker whom to call if the pickup is missed or the site is inaccessible.</p>
    <h2>Confirm arrival rather than assuming it</h2>
    <p>Ask the site contact to confirm who reached site and when. Mark no-shows, rejected access and substitutions separately. Operations should resolve the difference between the planned and actual list before attendance starts; a mobilisation date alone does not prove someone arrived.</p>
    <h2>Hand over to attendance and billing</h2>
    <p>Give the attendance team the confirmed assignment, shift, site and client approval process. Tell payroll about changes that affect pay and billing about the relevant agreed rate and timesheet sign-off. Preserve a record of who approved a transfer, substitution or end date.</p>
    <h2>When the assignment ends</h2>
    <p>Confirm the final day on site, demobilisation, return transport, accommodation changes and any equipment returned. Reconcile the last attendance and client-approved hours, and update availability before promising the worker to another project.</p>
    <p>For related records, see the <a href="/blog/visa-emirates-id-expiry-compliance-checklist">document expiry checklist</a> and the <a href="/tools/construction-timesheet-template">free construction timesheet template</a>.</p>
  </PostLayout></ContentShell>;
}
