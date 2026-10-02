# Demo Cheatsheet (UAE manpower client)

Flow: Dashboard → Profile → Employee → Letter → Supplier → Client → Project → Site → Demand → Facilities → Timesheet → Upload data → Finance → Permission → Search → AI
Open with `⌘K` ready. Say their words: LPO, demand, bed, WPS, TRN.

| # | Section | Route | Show (30 sec each) | Say |
|---|---|---|---|---|
| 1 | **Dashboard** | `/dashboards` | Workforce, billing, timesheet, demand tabs; alerts; compliance runway | "Everything you chase five people for each morning." |
| 2 | **Profile** | `/profile` | My profile, dashboard preference | "Each user sets their own view." |
| 3 | **Employee** | `/employees`, `/employees/renewals` | New worker (EID mask, IBAN/phone checks, save as draft); worker record: visa, labour card, history, documents; renewals list | "No more missed visa or EID expiry." |
| 4 | **Letter** | `/letters`, `/letter-templates` | Generate NOC / experience letter on letterhead with stamp | "Letters in 10 seconds, branded, audited." |
| 5 | **Supplier** | `/suppliers` | Sub-supplier list, offers, bills; **supplier portal** (demo account) | "Suppliers submit workers themselves, no phone chasing." |
| 6 | **Client** | `/clients` | Client, contacts, trade rates, LPOs | "Rates and LPOs live here, invoicing reads them." |
| 7 | **Project** | `/projects` | Project: client, people, contacts, assigned staff, holidays | "Every worker and hour ties to a project." |
| 8 | **Site** | `/sites` | Sites under a project | "Per-site deployment and arrival." |
| 9 | **Demand** | `/demand` | Raise demand → partial approval → supplier offers → allocation → mobilisation → site arrival → demobilisation; demand pack PDF | "From client request to worker on site, tracked." |
| 10 | **Facilities** | `/accommodation`, `/transport`, `/inventory` | Camps, rooms, bunk beds, check-in (own/supplier/client), switch camp; routes and vehicles; PPE/uniform stock | "Empty beds and transport gaps visible." |
| 11 | **Timesheet** | `/attendance`, `/timesheets`, `/invoices/client-timesheet`, `/invoices` | Daily attendance, corrections, monthly timesheet approval, client timesheet, VAT invoice | "One source of hours feeds invoice and payroll." |
| 12 | **Upload data** | `/upload`, `/history`, `/documents`; CSV import on `/clients`, `/suppliers` | Drop the consolidated timesheet workbook (month tabs like MAY-25 detected automatically, re-upload refreshes hours); history of uploads; scan passports/EIDs in Documents; CSV import for clients and suppliers | "Your Excel is not thrown away. Upload it and you are live." |
| 13 | **Finance** | `/finance`, `/payroll` | Expenses, supplier bills, part-payments, payroll run, WPS SIF export, gratuity | "Payroll and billing always agree." |
| 14 | **Permission** | `/settings/roles`, `/settings/team`, `/audit-log` | Custom access roles, team, branch switcher, audit log | "Who changed what, when." |
| 15 | **Search** | `⌘K` / command palette | Find a worker by name or ID, jump to "Raise demand" | "Anything in two keystrokes." |
| 16 | **AI** | Assistant (nav) | Ask: "Which visas expire this month?" and a create-link question | "Ask in plain English, it reads live data." |

## Before you go live
- Seed demo data and portal accounts (`APPLY=1`); create one draft payroll run (not seeded).
- Set `DEMO_LOGIN_CODE`; demo phone `+9711234567890`.
- Open tabs: admin, supplier portal, employee portal (`/me`).
- Keep a sample timesheet workbook (month tab) and a passport/EID image ready for upload.
- Test the AI question and a sample document extract beforehand.

## Don't promise
Tally/Zoho integration, biometric devices, Arabic UI, client portal, specific bank WPS format. Say "scoped in pilot."

## Close
Paid 2–4 week pilot on one branch. Ask for a data owner and a finance contact. Book follow-up in 3 working days.
