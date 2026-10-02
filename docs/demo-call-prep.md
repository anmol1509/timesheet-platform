# Demo Call Preparation: UAE Manpower Supply Company

Audience: owner / GM, operations manager, HR/PRO, accounts. Length: 45 min (30 min demo, 15 min discussion). Anything marked **[verify]** should be checked in the live environment before the call.

---

## 1. Goal of the call

Move the prospect from "we run this on Excel, WhatsApp and a legacy accounting package" to "we want a paid pilot on one branch." Success is a named pilot scope, a data-migration owner on their side, and a follow-up date. It is not a feature tour.

## 2. Who they are and what hurts

A UAE manpower supplier places blue-collar and site staff with contractor clients. Revenue = hours worked × client rate. Margin is lost in the gaps between those steps.

| Pain | What it costs them | Where we answer it |
|---|---|---|
| Timesheets arrive late, in different formats, are disputed | Delayed invoicing, 60–90 day cash cycle | Timesheets, Attendance, Client Timesheet, Invoices |
| Visa / Emirates ID / labour card / passport expiries missed | Fines, blocked workers, lost placements | Renewals, Compliance Runway, expiry sweep cron |
| Payroll and WPS errors, loans, overtime, final settlement | MOHRE penalties, worker disputes | Payroll, SIF export, Loans, End of Service |
| Demand from clients can't be matched to supply (own vs sub-supplier) | Lost orders, supplier chasing by phone | Demand Requests, Supplier offers and portal |
| Camp / bed / transport chaos | Empty beds paid for, check-in disputes | Accommodation, Bed Allocation, Transport |
| No per-client or per-project profit view | Pricing by gut feel | Dashboards, Finance, Bills, Expenses |
| Owner can't see the business without calling 5 people | Decisions are late | Dashboards (8 role views), Assistant |

## 3. Pre-call discovery (send 24h ahead or ask in first 5 min)

1. Headcount supplied today, and split own vs sub-supplier workers?
2. Number of active clients and projects; how many sites?
3. How are hours captured: client-signed sheets, biometric, supervisor WhatsApp?
4. Billing: monthly? Rates by trade, with fixed overtime multipliers? Any LPO per client?
5. Payroll: WPS via bank or exchange? Cash payers? Number of payroll companies/licences?
6. Do you run your own camps, rent from others, or both? Own transport?
7. What tools today (Excel, Tally, Zoho, QuickBooks, ERP)? Who maintains them?
8. Who decides, who signs, what is the timeline and budget owner?
9. What went wrong last month that you would pay to avoid?

Record the answers; the demo order in section 5 changes with their top two pains.

## 4. Call agenda (45 min)

| Min | Segment | Owner |
|---|---|---|
| 0–5 | Intros, confirm pains from discovery, agree success criteria | Lead |
| 5–10 | Their workflow in one picture: Demand → Supply → Deploy → Timesheet → Invoice → Payroll | Lead |
| 10–40 | Live demo (section 5) | Presenter |
| 40–45 | Pilot proposal, data needed, next step | Lead |

## 5. Demo script (30 min)

Use the seeded demo branch (section 7). Narrate in their language: client, LPO, demand, bed, WPS. Do not explain software; explain their day.

### Act 1: Owner view (3 min) — `/dashboards`
- Open the workforce, billing and timesheet dashboards. "Everything you ask five people for each morning."
- Show the alerts and the Compliance Runway: who expires in the next 30/60/90 days.
- Ask the in-app Assistant a plain question: "Which workers' visas expire this month?" Shows it reads live data. **[verify answer on seeded data first]**

### Act 2: Client demand to supply (6 min) — `/sales/enquiries`, `/sales/quotations`, Demand Requests
- Enquiry → quotation with trade lines and rates → client LPO tracked.
- Client raises a demand request for N trades. Partially approve it.
- Show the demand being sourced from sub-suppliers: supplier offers, allocations. Open the **Supplier Portal** (demo account) to show suppliers submitting workers and availability themselves instead of by phone.
- Print the demand pack / undertaking PDF.

### Act 3: Worker lifecycle and compliance (5 min) — `/employees`
- Register an employee: Emirates ID mask, IBAN and phone validation, searchable country/city. Save as draft and resume from Drafts.
- Open an existing worker: visa and labour card history, assignment history, documents, notes, inventory issued (PPE, uniform).
- `/employees/renewals`: one screen of what is expiring and for whom.
- Generate a NOC or experience letter from a template with the company letterhead and stamp.

### Act 4: Accommodation and transport (4 min) — `/accommodation`
- Camps → rooms → bunk beds with upper/lower berths and occupancy.
- Check-in a worker to own / supplier / client camp. Switch camp/room. Check-in PDF.
- Transport routes, vehicles, and stops by project.

### Act 5: Timesheet to invoice (6 min) — `/attendance`, `/timesheets`, `/invoices`
- Daily attendance, hours (regular vs overtime), correction requests approved by a supervisor.
- Roll attendance into the monthly timesheet and approval pipeline.
- Generate the **client timesheet** (what the client signs) and the **tax invoice** with TRN and VAT. Show invoice history and the finance export.
- Point: one source of hours feeds billing and payroll, so the two always agree.

### Act 6: Payroll and WPS (4 min) — `/payroll`
- Run by company, with hourly or monthly pay structures, loans and repayments, adjustments, then submit for approval.
- Export the **WPS SIF file** and CSV. Show end-of-service gratuity calculation.
- Reconciliation threshold: flags payroll vs timesheet mismatches.

### Act 7: Finance and control (2 min) — `/finance`, `/settings/roles`, `/audit-log`
- Expenses, supplier bills with part-payments, petty cash, budgets.
- Branch switcher, custom access roles, full audit log. "Who changed this rate, and when."

### Close
Show the **employee self-service portal** (`/me`: attendance, payslips, documents). It cuts HR "where is my payslip" calls.

## 6. Positioning and talking points

- **Built for supply, not generic HR.** The model has clients, LPOs, demand requests, sub-suppliers, camps and WPS as first-class objects. Generic HRMS tools bolt these on.
- **One chain of truth:** attendance → timesheet → invoice and payroll. No re-keying.
- **UAE-native:** TRN/VAT invoices, Emirates ID, labour card, visa tracking, IBAN, WPS SIF, gratuity, multi-emirate branches.
- **Sub-supplier network:** portal for suppliers to submit workers, offers, invoices and tickets.
- **Fast to adopt:** CSV import, document extraction (AI-read passports/IDs/visas) **[verify document extract demo on a sample file]**, searchable forms, drafts.

## 7. Environment and data setup (do the day before)

1. Confirm the deployment is up and the seeded database is healthy.
2. Seed realistic data (read-only by default, `APPLY=1` to write; `REMOVE=1` reverses it exactly):
   - `APPLY=1 npx tsx prisma/scripts/seed-demo-data.ts` — clients, projects, ~36 workers, LPOs, enquiries, quotations, demand requests with offers, two camps with beds, vehicles/routes, expenses and bills.
   - `APPLY=1 npx tsx prisma/scripts/seed-demo-portal-accounts.ts` — demo supplier and demo employee for the two portals.
3. Payroll runs are intentionally **not** seeded. Create one beforehand for a seeded company so Act 6 has content, and keep it in draft so you can submit live.
4. Set `DEMO_LOGIN_CODE` (6 digits, env only) so portal logins work without a real phone. Demo phone is `+9711234567890`.
5. Pre-log in on three tabs: admin, supplier portal, employee portal. Test in the screen-share browser at 1080p.
6. Have one real-looking passport/EID sample image ready for document extraction.
7. Rehearse the whole script once, timed. Note any page that is slow or empty and either fix the data or skip it.
8. Fallback: screenshots of each act in case of network issues.

## 8. Anticipated questions

| Question | Answer |
|---|---|
| Does it generate WPS files our bank accepts? | SIF export is built in. Confirm their bank/exchange format in the pilot **[verify against their bank spec]**. |
| Can we import our existing workers and clients? | Yes, CSV import plus document extraction. We do the first load with them. |
| We have several licences/companies. | Branches and payroll by company are supported. |
| Is our data safe? Where is it hosted? | Role-based access, per-branch scoping, audit log. State hosting region from the actual deployment **[confirm before the call]**. |
| Arabic / bilingual? | Not a current strength. Be honest, note as roadmap **[verify current state]**. |
| Does it integrate with Tally/Zoho/QuickBooks? | Finance export today; direct integrations scoped in pilot. Do not promise. |
| Biometric / GPS attendance devices? | Attendance is entered and corrected in-app. Device integration is a scoped item. Do not promise. |
| Can our clients log in? | Suppliers and employees have portals. A client portal is not built; clients receive PDFs/timesheets. **[verify]** |
| Pricing? | Per-branch or per-active-worker model; propose after discovery. Have a number range ready internally. |
| How long to go live? | Pilot on one branch in 3–4 weeks: setup, data load, training, parallel run for one payroll cycle. |
| What if a worker's Emirates ID or visa data is wrong? | Server-side validation on every form, draft saving, and full audit history. |

## 9. Objection handling

- **"We already use Excel/Tally and it works."** Ask what a late timesheet or a missed visa renewal costs per month. Offer to run the pilot in parallel; nothing is thrown away.
- **"Our staff won't adopt it."** Show the simplicity of daily attendance and the self-service portal. Include a half-day on-site training in the pilot.
- **"Too expensive."** Frame against fines, bed vacancy and invoice delay days. One week faster collection on their monthly billing usually dwarfs the licence.
- **"We need custom features."** Capture them live, tag as pilot scope vs roadmap, never commit a date on the call.

## 10. Close and next steps

Propose:
1. A **2–4 week paid pilot** on one branch or one client contract.
2. Their owner for data (workers, clients, rates, LPOs) and one finance contact for invoice/WPS validation.
3. A follow-up in 3 working days with: summary, pilot scope, timeline, and pricing.

Ask directly: "If the pilot proves timesheet-to-invoice and WPS accuracy, is there anything that would stop you moving forward?"

## 11. Roles on the call

- **Lead:** runs agenda, discovery, objections, close.
- **Presenter:** drives the app, follows the script, never improvises into unseeded areas.
- **Note-taker:** records pains, quotes, promises, follow-ups, and objections within 2 hours of the call.

## 12. Post-call checklist

- [ ] Send recap within 24h (pains heard, what we showed, pilot proposal).
- [ ] Log all **[verify]** answers resolved and any feature gaps raised.
- [ ] Prepare a tailored pilot plan and pricing.
- [ ] Remove or reset demo data if the environment is shared (`REMOVE=1 APPLY=1` on both seed scripts).
- [ ] Schedule the follow-up call before ending this one.
