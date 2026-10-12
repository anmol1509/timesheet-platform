# Payroll demo: one employee, start to finish

Total time: about 12 minutes. Use one demo company and one demo worker, not real staff.

## Before the customer joins (5 minutes)

Do the one-time setup first so the demo doesn't stall on it. The **Set up payroll** checklist at the top of `/payroll` shows what is missing.

1. **Own company.** Under Suppliers, tick "Own company" and add the MOHRE establishment ID.
2. **Payer bank.** Under Banks, add an active bank account with routing code and IBAN.
3. **Demo worker.** Create one worker in that company. On the worker's **Trade & pay** tab set:
   - Pay structure: Itemised
   - Basic: AED 3,000
   - Housing: AED 1,000
   - Transport: AED 500
   - Overtime on, multiplier 1.25
4. **Bank details.** On the **Payroll & WPS** tab, fill in the worker's bank, IBAN and labour card details. A run cannot be approved without them.
5. **Timesheet.** Have the worker's timesheet for the month ready: 2 absent days and about 10 overtime hours.
6. **Approver.** Log in as two users, one preparer and one approver. Above the approval limit, the person who prepared a run cannot approve it. Use two browser windows.

Run the whole thing once privately before the real demo. A payroll run is saved to the live database, so use a past month that you can delete afterwards.

## What the customer should see

The expected numbers, for the example above (30-day pay month, overtime rate = basic / 30 / 8 × 1.25):

| Item | Amount (AED) |
|---|---|
| Basic + allowances | 4,500.00 |
| Absence, 2 days (4,500 / 30 × 2) | −300.00 |
| Overtime, 10 hours (12.50 × 1.25 × 10) | +156.25 |
| **Net pay** | **4,356.25** |
| Advance recovered (added in step 4) | −200.00 |
| **Net pay after advance** | **4,156.25** |

If your supplier has its own absence rule (free days, fixed amount per day), the absence line will differ. Check the screen before you quote numbers.

## The demo, step by step

### 1. Frame the problem (1 minute)
Say: "Payroll is usually a spreadsheet, a bank file built by hand, and payslips made one at a time. Here it is one flow, and the numbers come from the same timesheets you already approve."

### 2. Start the run (1 minute)
- Open **Payroll**.
- Choose the company and the month, then press **Start payroll run**.
- Point out that it pulls pay structure and timesheet days by itself. Nobody typed hours in.

### 3. Open the employee's line (3 minutes)
- Open the run and find the worker's row.
- Walk through basic, allowances, absence deduction, overtime and net.
- Open the **day-by-day view**. It shows each day against the client's timesheet. Show that you can edit a day or copy it from the timesheet.
- Say: "If the client's hours and your records disagree, you see it here before anyone is paid."

### 4. Add the human adjustments (2 minutes)
- On the worker's line add a **Deduction** (for example a fine, AED 50), an **Advance** of AED 200, or an **Adjustment** (a bonus, or a negative to deduct). Each takes a note. Press **Save**.
- Say: "Every manual change carries a reason, so the audit trail explains itself."
- Optional: show **Loans** and **Recurring** under Payroll. A loan repays itself over the months.

### 5. Send for approval (1 minute)
- Press **Submit for approval**.
- Switch to the approver window. Open **Approvals** and choose the Payroll tab.
- Show **Return** (the approver must give a reason). Then press **Approve**.
- Say: "Above your limit, the person who prepared the run cannot approve it. That is the four-eyes rule."

### 6. Pay (2 minutes)
- Download the **bank file (WPS / SIF)**. Say: "This is what you upload to your bank's portal to pay everyone at once."
- Press **Mark as paid**.

### 7. Payslips and records (1 minute)
- Open **Payslips** and print or save the worker's payslip.
- Open the **three-dot menu** to download the CSV, the payroll register, and the accounting journal.

### 8. Close (1 minute)
Mention what else exists: part-month pay for joiners and leavers, final settlements and end-of-service, salary letters, and the employee self-service portal. Offer to cover any of these next.

## If something goes wrong

- **Approve is blocked: "Missing bank details".** Fix the worker's bank details inline from the run (the bank-details fix on the line), then press **Recalculate** in the three-dot menu.
- **Worker missing from the run.** Their pay structure isn't set. Check the Trade & pay tab.
- **Approve is blocked: "Someone other than the person who prepared this run".** Approve from the second user.
- **Wrong numbers.** Open the three-dot menu and press **Recalculate**. A draft can be edited freely. An approved run can be **Reopened** (before it is paid).
- **After the demo.** Delete the demo run from the three-dot menu while it is still a draft, or reopen it first.
