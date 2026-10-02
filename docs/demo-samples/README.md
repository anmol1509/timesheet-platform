# Demo sample files (all fictional)

| File | Where to upload | What happens |
|---|---|---|
| `consolidated-timesheet-AUG-SEP-2026.xlsx` | `/upload` | Two month tabs (AUG-26, SEP-26), 24 workers each, 3 suppliers, 2 clients, 8 trades. Creates suppliers, clients and timesheet entries. Re-upload to show "refreshes, no duplicates". |
| `clients-import.csv` | `/clients` → Import | 3 clients with 15-digit TRNs. |
| `suppliers-import.csv` | `/suppliers` → Import | 4 suppliers; the first 3 match the names in the workbook. |

Suggested order: import suppliers and clients CSVs first (shows contact and TRN detail), then upload the workbook (shows it matches existing names instead of creating duplicates).

Names, phones, emails and TRNs are made up. Run against the demo branch, not production. Delete via `/upload` (Delete) afterwards.

`sample-passport-SPECIMEN.png`: fictional passport bio page for the document-scan demo (`/documents`, or scan on the employee form). Country "Utopia" (ICAO sample code UTO), name Mohammed Specimen Rafiq, passport Z1234567, DOB 1992-03-14, expiry 2032-02-01. Watermarked SPECIMEN. Nationality will not map to a real country, so pick one manually if the form asks.

`employees-import.csv`: `/employees` → Import. 24 workers whose IDs, names and trades match the timesheet workbook (M1001, S1002 ...), so uploaded hours line up with real employee records. Import this before the workbook.

`workmen-comp-insurance-SPECIMEN.pdf`: `/suppliers` → open "Al Noor Manpower Supply LLC" → Workmen's compensation import. AI reads the employee table (12 names, category, designation, salary) so you can create workers from the certificate. Needs `ANTHROPIC_API_KEY` set. Watermarked SPECIMEN.

Recommended import order: suppliers → clients → employees → timesheet workbook.
