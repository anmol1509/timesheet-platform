import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { DailyHourCell } from "@/lib/parseTimesheet";
import type { Letterhead } from "@/lib/letterhead";

/**
 * Supplier timesheet, laid out to match the format the client's contractors
 * already issue and accept: A4 landscape, letterhead, one row per worker with
 * a column per calendar day, grouped with subtotals, then a second page
 * carrying the rate summary, the deduction breakdown and the payment notes.
 *
 * The day cells carry the same shorthand the industry uses — a number for
 * hours worked, W for the weekly off, A for absent, H for a public holiday —
 * because site supervisors read these at a glance and a different vocabulary
 * would slow them down.
 */
export type TimesheetEntry = {
  employeeIdNo: string;
  employeeName: string;
  trade: string;
  rate: number;
  /** Project code, when the entry has one. Excel uploads usually don't. */
  projectCode: string | null;
  dailyHours: DailyHourCell[];
  absentDeduction: number;
};

export type TimesheetPdfInput = {
  letterhead: Letterhead;
  /** The company the timesheet is billed to — printed as SUB-CONTRACTOR. */
  subContractor: string;
  subContractorCode: string | null;
  periodFrom: string;
  periodTo: string;
  entries: TimesheetEntry[];
  additions: number;
  safetyDeduction: number;
  otherDeduction: number;
  vatPercent: number;
  /** Two separate blocks: preparing and verifying are different signatures. */
  preparedBy: string | null;
  preparedByRole: string | null;
  verifiedBy: string | null;
  verifiedByRole: string | null;
  notes: string[];
};

/** The competitor's standard payment conditions, kept as the default. */
export const DEFAULT_TIMESHEET_NOTES = [
  "Invoice submission should not exceed more than 14 days from the date of Timesheet received.",
  "Mention both companies' Tax Registration No (TRN).",
  "Attach the Time sheet, otherwise the Invoice will be rejected.",
  "If you are not registered with VAT you have to submit a NON REGISTER OF VAT letter on your company letterhead, along with your invoice.",
  "Total amount in words must be mentioned in the Invoice, otherwise the Invoice will be rejected.",
  "If any labour hours are missing in your time sheet it must be intimated within 3 working days.",
];

const NAVY = "#2B3187";
const RED = "#E8232A";
const LINE = "#000000";

const s = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 26,
    paddingHorizontal: 16,
    fontSize: 6.5,
    fontFamily: "Helvetica",
    color: "#000",
  },

  headBand: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  logo: { width: 74, height: 54, objectFit: "contain" },
  companyBlock: { flex: 1, paddingHorizontal: 8 },
  companyName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY },
  contactBlock: { width: 190 },
  contactRow: { flexDirection: "row", justifyContent: "flex-end" },
  contactLabel: { width: 34, fontSize: 6.5, color: "#000" },
  contactValue: { fontSize: 6.5, textAlign: "left", width: 130 },

  rule: { height: 1.4, backgroundColor: NAVY, marginBottom: 4 },
  ruleThin: { height: 0.6, backgroundColor: RED, marginBottom: 6 },

  subContractor: { fontSize: 8, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  period: { fontSize: 8, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 6 },

  table: { borderWidth: 0.6, borderColor: LINE },
  row: { flexDirection: "row", borderBottomWidth: 0.4, borderColor: LINE },
  cell: {
    borderRightWidth: 0.4,
    borderColor: LINE,
    paddingVertical: 1.6,
    paddingHorizontal: 1,
    justifyContent: "center",
  },
  th: { fontSize: 5.6, fontFamily: "Helvetica-Bold", textAlign: "center" },
  td: { fontSize: 6, textAlign: "center" },
  // Absences are what gets queried on a timesheet, so they're findable by eye
  // rather than by reading every cell.
  absentCell: { backgroundColor: "#F7A23B" },
  absentText: { fontSize: 6, textAlign: "center", fontFamily: "Helvetica-Bold", color: "#7A3E00" },
  tdLeft: { fontSize: 6, textAlign: "left" },
  groupRow: { flexDirection: "row", borderBottomWidth: 0.4, borderColor: LINE },
  groupLabel: { fontSize: 6.5, fontFamily: "Helvetica-Bold", paddingVertical: 1.8, paddingLeft: 3 },
  subTotalRow: { flexDirection: "row", borderBottomWidth: 0.4, borderColor: LINE },
  subTotalLabel: {
    fontSize: 6.2,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    paddingRight: 4,
  },
  totalRow: { flexDirection: "row", backgroundColor: "#E8EAF6" },

  footer: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 7,
  },

  // Page 2
  summaryHead: { flexDirection: "row", borderBottomWidth: 0.8, borderColor: LINE },
  noteText: { fontSize: 6.4, marginBottom: 2.5, lineHeight: 1.35 },
  moneyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 1.8,
    borderBottomWidth: 0.4,
    borderColor: "#94A3B8",
  },
  moneyLabel: { fontSize: 7 },
  moneyValue: { fontSize: 7, fontFamily: "Helvetica-Bold" },
});

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function money(n: number) {
  return n.toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function hours(n: number) {
  return n.toLocaleString("en-AE", { maximumFractionDigits: 2 });
}

/**
 * The roster records the weekly off as "OFF"; this format prints it as "W",
 * which is what site supervisors and the client's contractors read.
 */
function dayMarker(value: string) {
  const v = String(value).trim().toUpperCase();
  if (v === "OFF" || v === "WO") return "W";
  return value;
}

/** Only numeric cells count as worked hours; W/A/H are markers, not values. */
function cellHours(cell: DailyHourCell) {
  const n = Number(cell.value);
  return cell.value !== "" && !Number.isNaN(n) ? n : 0;
}

function countAbsent(cells: DailyHourCell[]) {
  return cells.filter((c) => String(c.value).trim().toUpperCase() === "A").length;
}

export async function generateTimesheetPdf(input: TimesheetPdfInput): Promise<Buffer> {
  const dayCount = input.entries[0]?.dailyHours.length ?? 30;

  // Column widths tuned so 31 days plus the fixed columns fit A4 landscape
  // (810pt usable) without spilling onto a second sheet.
  const W = { sn: 15, id: 38, name: 88, trade: 48, total: 24, absent: 30, ded: 36 };
  const dayW = Math.max(
    9,
    (810 - (W.sn + W.id + W.name + W.trade + W.total + W.absent + W.ded)) / dayCount
  );

  // Grouped by project, as the reference does. Workers whose entry carries no
  // project are collected under one labelled heading rather than being hidden
  // in an unnamed block — the gap should be obvious on the page.
  const NO_PROJECT = "No project assigned";
  const groups = new Map<string, TimesheetEntry[]>();
  for (const e of input.entries) {
    const key = e.projectCode || NO_PROJECT;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  // Named projects first; the unassigned block sits at the end.
  const orderedGroups = [...groups.entries()].sort(([a], [b]) =>
    a === NO_PROJECT ? 1 : b === NO_PROJECT ? -1 : a.localeCompare(b)
  );

  const totals = { hours: 0, absent: 0, deduction: 0 };
  for (const e of input.entries) {
    totals.hours += e.dailyHours.reduce((sum, c) => sum + cellHours(c), 0);
    totals.absent += countAbsent(e.dailyHours);
    totals.deduction += e.absentDeduction || 0;
  }

  // Rate summary, one line per trade-and-project pairing, as on their page 2.
  const summary = new Map<
    string,
    { trade: string; project: string; hours: number; rate: number; amount: number }
  >();
  for (const e of input.entries) {
    const project = e.projectCode || "—";
    const key = `${e.trade}__${project}__${e.rate}`;
    const worked = e.dailyHours.reduce((sum, c) => sum + cellHours(c), 0);
    const existing = summary.get(key);
    if (existing) {
      existing.hours += worked;
      existing.amount += worked * e.rate;
    } else {
      summary.set(key, {
        trade: e.trade,
        project,
        hours: worked,
        rate: e.rate,
        amount: worked * e.rate,
      });
    }
  }
  const summaryRows = [...summary.values()]
    .filter((r) => r.hours > 0)
    .sort(
    (a, b) => a.trade.localeCompare(b.trade) || a.project.localeCompare(b.project)
  );

  const grossBeforeDeductions = summaryRows.reduce((sum, r) => sum + r.amount, 0);
  const totalDeduction =
    totals.deduction + (input.safetyDeduction || 0) + (input.otherDeduction || 0);
  const grossTotal = grossBeforeDeductions + (input.additions || 0) - totalDeduction;
  const vat = grossTotal * (input.vatPercent / 100);
  const netPayable = grossTotal + vat;

  const Head = () => (
    <>
      <View style={s.headBand}>
        {input.letterhead.logo ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt
          <Image src={input.letterhead.logo} style={s.logo} />
        ) : (
          <View style={s.logo} />
        )}
        <View style={s.companyBlock}>
          <Text style={s.companyName}>{input.letterhead.name.toUpperCase()}</Text>
          {input.letterhead.addressLines.map((line, i) => (
            <Text key={i} style={{ fontSize: 6.5 }}>
              {line}
            </Text>
          ))}
        </View>
        <View style={s.contactBlock}>
          {[
            ["T", input.letterhead.phone],
            ["F", input.letterhead.fax],
            ["E-Mail", input.letterhead.email],
            ["P.O. Box", input.letterhead.poBox],
            ["TRN", input.letterhead.trn],
          ]
            .filter(([, value]) => !!value)
            .map(([label, value]) => (
              <View key={label as string} style={s.contactRow}>
                <Text style={s.contactLabel}>{label}</Text>
                <Text style={s.contactValue}>{value}</Text>
              </View>
            ))}
        </View>
      </View>
      <View style={s.rule} />
      <View style={s.ruleThin} />
      <Text style={s.subContractor}>
        SUB-CONTRACTOR :{input.subContractorCode ? `${input.subContractorCode} ` : " "}
        {input.subContractor.toUpperCase()}
      </Text>
      <Text style={s.period}>
        Time Sheet Period From {input.periodFrom} to {input.periodTo}
      </Text>
    </>
  );

  const doc = (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <Head />

        <View style={s.table}>
          {/* Weekday strip above the day numbers, as on the reference. */}
          <View style={s.row}>
            <View style={[s.cell, { width: W.sn }]} />
            <View style={[s.cell, { width: W.id }]} />
            <View style={[s.cell, { width: W.name }]} />
            <View style={[s.cell, { width: W.trade }]} />
            <View style={[s.cell, { width: W.total }]} />
            {Array.from({ length: dayCount }).map((_, i) => {
              const date = input.entries[0]?.dailyHours[i]?.date;
              return (
                <View key={i} style={[s.cell, { width: dayW }]}>
                  <Text style={s.th}>
                    {date ? WEEKDAY[new Date(date + "T00:00:00Z").getUTCDay()] : ""}
                  </Text>
                </View>
              );
            })}
            <View style={[s.cell, { width: W.absent }]} />
            <View style={[s.cell, { width: W.ded, borderRightWidth: 0 }]} />
          </View>

          <View style={[s.row, { borderBottomWidth: 0.8 }]}>
            <View style={[s.cell, { width: W.sn }]}>
              <Text style={s.th}>S#</Text>
            </View>
            <View style={[s.cell, { width: W.id }]}>
              <Text style={s.th}>I. D. No</Text>
            </View>
            <View style={[s.cell, { width: W.name }]}>
              <Text style={s.th}>EMPLOYEE NAME</Text>
            </View>
            <View style={[s.cell, { width: W.trade }]}>
              <Text style={s.th}>TRADE</Text>
            </View>
            <View style={[s.cell, { width: W.total }]}>
              <Text style={s.th}>TOTAL</Text>
            </View>
            {Array.from({ length: dayCount }).map((_, i) => {
              const date = input.entries[0]?.dailyHours[i]?.date;
              return (
                <View key={i} style={[s.cell, { width: dayW }]}>
                  <Text style={s.th}>{date ? Number(date.slice(8, 10)) : i + 1}</Text>
                </View>
              );
            })}
            <View style={[s.cell, { width: W.absent }]}>
              <Text style={[s.th, { fontSize: 5 }]}>ABSENT</Text>
              <Text style={[s.th, { fontSize: 5 }]}>TOTAL</Text>
            </View>
            <View style={[s.cell, { width: W.ded, borderRightWidth: 0 }]}>
              <Text style={[s.th, { fontSize: 5 }]}>DEDUCTION</Text>
              <Text style={[s.th, { fontSize: 5 }]}>TOTAL</Text>
            </View>
          </View>

          {orderedGroups.map(([groupKey, rows]) => {
            const gHours = rows.reduce(
              (sum, e) => sum + e.dailyHours.reduce((t, c) => t + cellHours(c), 0),
              0
            );
            const gAbsent = rows.reduce((sum, e) => sum + countAbsent(e.dailyHours), 0);
            const gDed = rows.reduce((sum, e) => sum + (e.absentDeduction || 0), 0);

            return (
              <View key={groupKey}>
                <View style={s.groupRow}>
                  <Text style={s.groupLabel}>{groupKey}</Text>
                </View>

                {rows.map((e, index) => {
                  const worked = e.dailyHours.reduce((t, c) => t + cellHours(c), 0);
                  return (
                    <View key={`${e.employeeIdNo}-${index}`} style={s.row} wrap={false}>
                      <View style={[s.cell, { width: W.sn }]}>
                        <Text style={s.td}>{index + 1}</Text>
                      </View>
                      <View style={[s.cell, { width: W.id }]}>
                        <Text style={s.td}>{e.employeeIdNo}</Text>
                      </View>
                      <View style={[s.cell, { width: W.name }]}>
                        <Text style={s.tdLeft}>{e.employeeName}</Text>
                      </View>
                      <View style={[s.cell, { width: W.trade }]}>
                        <Text style={s.td}>{e.trade}</Text>
                      </View>
                      <View style={[s.cell, { width: W.total }]}>
                        <Text style={[s.td, { fontFamily: "Helvetica-Bold" }]}>
                          {hours(worked)}
                        </Text>
                      </View>
                      {e.dailyHours.map((cell, i) => {
                        const absent = String(cell.value).trim().toUpperCase() === "A";
                        return (
                          <View
                            key={i}
                            style={[s.cell, { width: dayW }, absent ? s.absentCell : {}]}
                          >
                            <Text style={absent ? s.absentText : s.td}>
                              {dayMarker(cell.value)}
                            </Text>
                          </View>
                        );
                      })}
                      <View style={[s.cell, { width: W.absent }]}>
                        <Text style={s.td}>{countAbsent(e.dailyHours) || ""}</Text>
                      </View>
                      <View style={[s.cell, { width: W.ded, borderRightWidth: 0 }]}>
                        <Text style={s.td}>{e.absentDeduction ? money(e.absentDeduction) : ""}</Text>
                      </View>
                    </View>
                  );
                })}

                <View style={s.subTotalRow}>
                  <View
                    style={[s.cell, { width: W.sn + W.id + W.name + W.trade }]}
                  >
                    <Text style={s.subTotalLabel}>SubTotal</Text>
                  </View>
                  <View style={[s.cell, { width: W.total }]}>
                    <Text style={[s.td, { fontFamily: "Helvetica-Bold" }]}>{hours(gHours)}</Text>
                  </View>
                  <View style={[s.cell, { width: dayW * dayCount }]} />
                  <View style={[s.cell, { width: W.absent }]}>
                    <Text style={[s.td, { fontFamily: "Helvetica-Bold" }]}>{gAbsent || 0}</Text>
                  </View>
                  <View style={[s.cell, { width: W.ded, borderRightWidth: 0 }]}>
                    <Text style={[s.td, { fontFamily: "Helvetica-Bold" }]}>{money(gDed)}</Text>
                  </View>
                </View>
              </View>
            );
          })}

          <View style={s.totalRow}>
            <View style={[s.cell, { width: W.sn + W.id + W.name + W.trade }]}>
              <Text style={s.subTotalLabel}>Total</Text>
            </View>
            <View style={[s.cell, { width: W.total }]}>
              <Text style={[s.td, { fontFamily: "Helvetica-Bold" }]}>{hours(totals.hours)}</Text>
            </View>
            <View style={[s.cell, { width: dayW * dayCount }]} />
            <View style={[s.cell, { width: W.absent }]}>
              <Text style={[s.td, { fontFamily: "Helvetica-Bold" }]}>{totals.absent}</Text>
            </View>
            <View style={[s.cell, { width: W.ded, borderRightWidth: 0 }]}>
              <Text style={[s.td, { fontFamily: "Helvetica-Bold" }]}>
                {money(totals.deduction)}
              </Text>
            </View>
          </View>
        </View>

        <Text
          style={s.footer}
          render={({ pageNumber }) => `Page ${pageNumber}`}
          fixed
        />
      </Page>

      <Page size="A4" orientation="landscape" style={s.page}>
        <Head />

        <View style={{ flexDirection: "row", gap: 16 }}>
          <View style={{ width: 420 }}>
            <View style={s.summaryHead}>
              <View style={[s.cell, { width: 110, borderRightWidth: 0 }]}>
                <Text style={s.th}>TRADE</Text>
              </View>
              <View style={[s.cell, { width: 90, borderRightWidth: 0 }]}>
                <Text style={s.th}>PROJECT</Text>
              </View>
              <View style={[s.cell, { width: 60, borderRightWidth: 0 }]}>
                <Text style={s.th}>HOUR</Text>
              </View>
              <View style={[s.cell, { width: 60, borderRightWidth: 0 }]}>
                <Text style={s.th}>RATE</Text>
              </View>
              <View style={[s.cell, { width: 100, borderRightWidth: 0 }]}>
                <Text style={s.th}>AMOUNT (DHS)</Text>
              </View>
            </View>

            {summaryRows.map((r, i) => (
              <View key={i} style={[s.row, { borderColor: "#94A3B8" }]}>
                <View style={[s.cell, { width: 110, borderRightWidth: 0 }]}>
                  <Text style={s.tdLeft}>{r.trade.toUpperCase()}</Text>
                </View>
                <View style={[s.cell, { width: 90, borderRightWidth: 0 }]}>
                  <Text style={s.td}>{r.project}</Text>
                </View>
                <View style={[s.cell, { width: 60, borderRightWidth: 0 }]}>
                  <Text style={s.td}>{hours(r.hours)}</Text>
                </View>
                <View style={[s.cell, { width: 60, borderRightWidth: 0 }]}>
                  <Text style={s.td}>{r.rate}</Text>
                </View>
                <View style={[s.cell, { width: 100, borderRightWidth: 0 }]}>
                  <Text style={[s.td, { textAlign: "right" }]}>{money(r.amount)}</Text>
                </View>
              </View>
            ))}

            <View style={[s.row, { borderTopWidth: 0.8, borderBottomWidth: 0 }]}>
              <View style={[s.cell, { width: 200, borderRightWidth: 0 }]}>
                <Text style={[s.subTotalLabel, { textAlign: "left", paddingLeft: 3 }]}>Total</Text>
              </View>
              <View style={[s.cell, { width: 60, borderRightWidth: 0 }]}>
                <Text style={[s.td, { fontFamily: "Helvetica-Bold" }]}>{hours(totals.hours)}</Text>
              </View>
              <View style={[s.cell, { width: 60, borderRightWidth: 0 }]} />
              <View style={[s.cell, { width: 100, borderRightWidth: 0 }]}>
                <Text
                  style={[s.td, { textAlign: "right", fontFamily: "Helvetica-Bold" }]}
                >
                  {money(grossBeforeDeductions)}
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 10, width: 300 }}>
              <View style={s.moneyRow}>
                <Text style={s.moneyLabel}>ADDITIONS</Text>
                <Text style={s.moneyValue}>{money(input.additions || 0)}</Text>
              </View>
              <View style={s.moneyRow}>
                <Text style={s.moneyLabel}>Absent Penalty</Text>
                <Text style={s.moneyValue}>{money(totals.deduction)}</Text>
              </View>
              <View style={s.moneyRow}>
                <Text style={s.moneyLabel}>Safety Items</Text>
                <Text style={s.moneyValue}>{money(input.safetyDeduction || 0)}</Text>
              </View>
              <View style={s.moneyRow}>
                <Text style={s.moneyLabel}>Other Deduction</Text>
                <Text style={s.moneyValue}>{money(input.otherDeduction || 0)}</Text>
              </View>
              <View style={s.moneyRow}>
                <Text style={s.moneyLabel}>Total Deduction AED</Text>
                <Text style={s.moneyValue}>{money(totalDeduction)}</Text>
              </View>
              <View style={s.moneyRow}>
                <Text style={s.moneyLabel}>Gross Total AED</Text>
                <Text style={s.moneyValue}>{money(grossTotal)}</Text>
              </View>
              <View style={s.moneyRow}>
                <Text style={s.moneyLabel}>VAT @{input.vatPercent}%</Text>
                <Text style={s.moneyValue}>{money(vat)}</Text>
              </View>
              <View style={[s.moneyRow, { borderBottomWidth: 0 }]}>
                <Text style={[s.moneyLabel, { fontFamily: "Helvetica-Bold" }]}>
                  Net Amount Payable AED
                </Text>
                <Text style={[s.moneyValue, { fontSize: 8 }]}>{money(netPayable)}</Text>
              </View>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            {input.notes.map((note, i) => (
              <Text key={i} style={s.noteText}>
                {i + 1}. {note}
              </Text>
            ))}

            {/* Separate blocks with their own signature rules: the person who
                prepares the sheet is not the person who verifies it. */}
            <View style={{ marginTop: 30, flexDirection: "row", gap: 28 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>PREPARED BY</Text>
                <View style={{ height: 30 }} />
                <View style={{ height: 0.6, backgroundColor: "#000" }} />
                <Text style={{ fontSize: 7, marginTop: 2 }}>{input.preparedBy || ""}</Text>
                {input.preparedByRole && (
                  <Text style={{ fontSize: 6.5, color: "#444" }}>{input.preparedByRole}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>VERIFIED BY</Text>
                <View style={{ height: 30 }} />
                <View style={{ height: 0.6, backgroundColor: "#000" }} />
                <Text style={{ fontSize: 7, marginTop: 2 }}>{input.verifiedBy || ""}</Text>
                {input.verifiedByRole && (
                  <Text style={{ fontSize: 6.5, color: "#444" }}>{input.verifiedByRole}</Text>
                )}
              </View>
            </View>
          </View>
        </View>

        <Text
          style={s.footer}
          render={({ pageNumber }) => `Page ${pageNumber}`}
          fixed
        />
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
