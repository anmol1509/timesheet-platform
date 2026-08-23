import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import {
  DEFAULT_LETTER_COLUMNS,
  LETTER_TABLE_COLUMNS,
  formatLetterDate,
  type LetterColumnKey,
  type LetterGroup,
  type LetterWorker,
} from "@/lib/letterLayout";

/**
 * The NOC and Undertaking, in the format the client's own letters use.
 *
 * One <Page> set per issuing company: a selection spanning three suppliers
 * comes back as one file of three letters, each speaking for its own company,
 * rather than one letter with a mixed table that no company could sign.
 */

export type LetterIssuer = {
  /** The formal name that signs the letter. */
  name: string;
  signatoryName: string | null;
  signatoryPhone: string | null;
  signatoryEmail: string | null;
  /**
   * The company's blank letterhead as a data URI, when printing on letterhead
   * and a usable image is on file. Null prints the plain layout.
   */
  letterheadImage: string | null;
};

export type LetterSection = {
  group: LetterGroup;
  issuer: LetterIssuer;
  /** Merge fields already substituted. */
  bodyText: string;
};

export type LetterPdfInput = {
  title: string;
  clientName: string;
  clientAddress: string | null;
  projectName: string;
  date: Date;
  sections: LetterSection[];
  /** Defaults to the client's own column set. */
  columns?: LetterColumnKey[];
};

// Printed content is inset from the top when a letterhead image is behind it,
// so the pre-printed header is never written over. 150pt clears the header
// block on a normal A4 letterhead; the footer margin does the same at the foot.
const LETTERHEAD_TOP_INSET = 150;
const LETTERHEAD_BOTTOM_INSET = 90;

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 48, paddingHorizontal: 44, fontSize: 9, fontFamily: "Helvetica" },
  pageOnLetterhead: {
    paddingTop: LETTERHEAD_TOP_INSET,
    paddingBottom: LETTERHEAD_BOTTOM_INSET,
    paddingHorizontal: 52,
    fontSize: 9,
    fontFamily: "Helvetica",
  },
  background: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%" },
  date: { marginBottom: 14 },
  addressee: { marginBottom: 2 },
  addresseeName: { fontFamily: "Helvetica-Bold" },
  project: { marginTop: 6, marginBottom: 12, fontFamily: "Helvetica-Bold" },
  title: { marginBottom: 12, fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center", textDecoration: "underline" },
  paragraph: { marginBottom: 8, lineHeight: 1.5, textAlign: "justify" },
  table: { marginTop: 10, borderWidth: 0.5, borderColor: "#000000" },
  headerRow: { flexDirection: "row", backgroundColor: "#D9D9D9" },
  row: { flexDirection: "row" },
  cell: { paddingVertical: 4, paddingHorizontal: 3, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: "#000000", justifyContent: "center" },
  headerCell: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  bodyCell: { fontSize: 8 },
  signature: { marginTop: 26 },
  signatureCompany: { fontFamily: "Helvetica-Bold", marginTop: 2 },
});

function cellValue(key: string, worker: LetterWorker, index: number, companyName: string) {
  switch (key) {
    case "SNO":
      return String(index + 1);
    case "NAME":
      return worker.name.toUpperCase();
    case "COMPANY":
      return companyName;
    case "DESIGNATION":
      return worker.trade ?? "";
    case "NATIONALITY":
      return (worker.nationality ?? "").toUpperCase();
    case "PASSPORT":
      return worker.passportNumber ?? "";
    case "ID_NUMBER":
      return worker.emiratesId ?? "";
    case "EMPLOYEE_ID":
      return worker.employeeIdNo;
    case "VISA_STATUS":
      return worker.visaStatus ?? "";
    default:
      return "";
  }
}

function LetterBody({
  input,
  section,
}: {
  input: LetterPdfInput;
  section: LetterSection;
}) {
  const paragraphs = section.bodyText.split(/\n+/).filter((p) => p.trim().length > 0);
  const companyName = section.group.supplierName ?? section.issuer.name;
  const chosen = new Set<LetterColumnKey>(input.columns ?? DEFAULT_LETTER_COLUMNS);
  const selected = LETTER_TABLE_COLUMNS.filter((c) => chosen.has(c.key));
  // Proportional rather than fixed widths: the widths express how much room a
  // column deserves relative to the others, so any selection fills the page
  // exactly instead of nine columns running off the edge of it.
  const totalWeight = selected.reduce((sum, c) => sum + c.width, 0) || 1;
  const columns = selected.map((c) => ({
    ...c,
    percent: `${((c.width / totalWeight) * 100).toFixed(4)}%`,
  }));

  return (
    <>
      <Text style={s.date}>Date: {formatLetterDate(input.date)}</Text>

      <Text style={s.addressee}>To,</Text>
      <Text style={[s.addressee, s.addresseeName]}>M/s. {input.clientName.toUpperCase()}</Text>
      {input.clientAddress && <Text style={s.addressee}>{input.clientAddress}</Text>}

      <Text style={s.project}>Project: {input.projectName}</Text>

      <Text style={s.title}>{input.title.toUpperCase()}</Text>

      {paragraphs.map((p, i) => (
        <Text key={i} style={s.paragraph}>
          {p}
        </Text>
      ))}

      {section.group.workers.length > 0 && (
        <View style={s.table}>
          <View style={s.headerRow} fixed>
            {columns.map((c) => (
              <View key={c.key} style={[s.cell, { width: c.percent }]}>
                <Text style={s.headerCell}>{c.label}</Text>
              </View>
            ))}
          </View>
          {section.group.workers.map((w, i) => (
            <View key={w.id} style={s.row} wrap={false}>
              {columns.map((c) => (
                <View key={c.key} style={[s.cell, { width: c.percent }]}>
                  <Text style={s.bodyCell}>{cellValue(c.key, w, i, companyName)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}

      <View style={s.signature}>
        <Text>For and on behalf of</Text>
        <Text style={s.signatureCompany}>{section.issuer.name.toUpperCase()}</Text>
        {section.issuer.signatoryName && <Text>{section.issuer.signatoryName}</Text>}
        {section.issuer.signatoryPhone && <Text>Mob: {section.issuer.signatoryPhone}</Text>}
        {section.issuer.signatoryEmail && <Text>Email: {section.issuer.signatoryEmail}</Text>}
      </View>
    </>
  );
}

export async function generateLetterPdf(input: LetterPdfInput): Promise<Buffer> {
  const doc = (
    <Document>
      {input.sections.map((section, i) => {
        const onLetterhead = !!section.issuer.letterheadImage;
        return (
          <Page key={i} size="A4" style={onLetterhead ? s.pageOnLetterhead : s.page}>
            {/* Repeated on every page of this letter, so a table that runs on
                doesn't leave later pages bare. */}
            {onLetterhead && (
              <Image src={section.issuer.letterheadImage!} style={s.background} fixed />
            )}
            <LetterBody input={input} section={section} />
          </Page>
        );
      })}
    </Document>
  );
  return renderToBuffer(doc);
}
