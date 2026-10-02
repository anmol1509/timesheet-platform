# Demo sample files (all fictional)

| File | Where to upload | What happens |
|---|---|---|
| `consolidated-timesheet-AUG-SEP-2026.xlsx` | `/upload` | Two month tabs (AUG-26, SEP-26), 24 workers each, 3 suppliers, 2 clients, 8 trades. Creates suppliers, clients and timesheet entries. Re-upload to show "refreshes, no duplicates". |
| `clients-import.csv` | `/clients` → Import | 3 clients with 15-digit TRNs. |
| `suppliers-import.csv` | `/suppliers` → Import | 4 suppliers; the first 3 match the names in the workbook. |

Suggested order: import suppliers and clients CSVs first (shows contact and TRN detail), then upload the workbook (shows it matches existing names instead of creating duplicates).

Names, phones, emails and TRNs are made up. Run against the demo branch, not production. Delete via `/upload` (Delete) afterwards.
