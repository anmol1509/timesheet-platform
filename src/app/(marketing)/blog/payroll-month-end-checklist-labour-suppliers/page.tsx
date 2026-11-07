import type { Metadata } from "next";
import { finishMetadata } from "@/lib/seo/metadata";
import { ContentShell } from "@/app/(marketing)/welcome/content-shell";
import { PostLayout } from "../post-layout";
import { POSTS } from "../posts";

const post = POSTS.find((p) => p.slug === "payroll-month-end-checklist-labour-suppliers")!;
const url = `https://manpowersync.com/blog/${post.slug}`;
export const metadata: Metadata = finishMetadata({ title: post.title, description: post.description, alternates: { canonical: url }, robots: { index: true, follow: true }, openGraph: { title: post.title, description: post.description, url, type: "article" } });

export default function Page() {
  return <ContentShell><PostLayout post={post}>
    <p>A reliable payroll close starts before the salary file is sent. Use this checklist to collect the month&rsquo;s changes, reconcile payroll inputs, obtain approval and follow each payment through to confirmation. Adapt it to your employment arrangements and your bank or WPS agent&rsquo;s current instructions.</p>
    <h2>1. Confirm the payroll population and period</h2>
    <p>Identify the company, payroll period and workers included. Review new starters, leavers, transfers and unpaid leave against the authorised records. Check that each worker has a unique identifier and that employee, establishment and payment details are current.</p>
    <h2>2. Reconcile attendance and approved changes</h2>
    <p>Collect approved attendance, overtime, leave, allowances and deductions. Investigate missing days, duplicate entries and late corrections with the site or HR team. Client-billable hours may differ from payroll hours; document the reason rather than forcing the two totals to match.</p>
    <h2>3. Review the payroll calculation</h2>
    <p>Check each component against contracts, authorised changes and the applicable rules. Reconcile the number of employees and payroll totals to the prior month and investigate significant changes. Record who checked the draft and obtain the approvals required by your company.</p>
    <h2>4. Prepare and check the WPS salary file</h2>
    <p>Use your bank or payment agent&rsquo;s current specification. Verify employer and employee identifiers, account details, the salary period, record count and totals. The <a href="/tools/wps-sif-file-checker">free WPS SIF checker</a> can help identify some format issues, but it cannot confirm that a bank will accept the file or that payments are compliant. Handle salary and bank details securely.</p>
    <h2>5. Submit and confirm payments</h2>
    <p>Send the approved file through your authorised bank or agent channel. Retain the submission reference and confirm acceptance and payment status. Investigate rejected files or individual records promptly with the bank or agent and follow up on unpaid employees. The <a href="/blog/wps-sif-rejection-reasons-uae">WPS rejection troubleshooting guide</a> sets out checks to discuss with them.</p>
    <h2>6. Close and retain the evidence</h2>
    <p>Save the approved inputs, payroll summary, approval trail and bank confirmations in access-controlled storage under your retention policy. Assign an owner to unresolved corrections, and note changes needed before the next run.</p>
    <p>The <a href="https://centralbank.ae/en/our-operations/payments-and-settlements/uae-wages-protection-system-uaewps">UAE Central Bank&rsquo;s WPS overview</a> describes the roles of employers, banks and agents. For employment obligations, confirm the current rules with <a href="https://www.mohre.gov.ae/">MOHRE</a> and obtain professional advice for your circumstances.</p>
  </PostLayout></ContentShell>;
}
