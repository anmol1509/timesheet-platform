"use client";

import { Bus, Sparkles } from "lucide-react";
import { m } from "motion/react";
import { EASE_PREMIUM } from "./motion";
import s from "./welcome.module.css";

const fieldVariant = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_PREMIUM } },
};

const inView = { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.5 } } as const;

/** Passport scan → extracted fields. */
export function DocumentsVisual() {
  return (
    <m.div className={`${s.diveVisual} ${s["tint-sky"]}`} aria-hidden {...inView}>
      <div className={s.diveCard}>
        <m.div className={s.scan} variants={{ hidden: {}, show: {} }}>
          <m.span
            className={s.scanThumb}
            style={{ position: "relative", overflow: "hidden" }}
            variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3 } } }}
          >
            <m.span
              className={s.scanLine}
              variants={{
                hidden: { y: -6, opacity: 0 },
                show: { y: 60, opacity: [0, 1, 1, 0], transition: { duration: 0.9, ease: "easeInOut", delay: 0.15 } },
              }}
            />
          </m.span>
          <div>
            <b>passport_scan.pdf</b>
            <m.div
              className={s.miniMuted}
              style={{ fontSize: 13 }}
              variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3, delay: 1.05 } } }}
            >
              <Sparkles size={13} style={{ verticalAlign: "-2px" }} /> 6 fields extracted
            </m.div>
          </div>
        </m.div>
        <m.div variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 1.2 } } }}>
          {[
            ["Full name", "Rajesh Kumar"],
            ["Passport no.", "Z4821••••"],
            ["Nationality", "India"],
            ["Visa expiry", <span key="v" className={`${s.tag} ${s.tagOrange}`}>in 28 days</span>],
            ["Emirates ID", "784-19••-•••••••-2"],
          ].map(([k, v], i) => (
            <m.div key={String(k)} className={s.field} variants={fieldVariant}>
              <span className={s.fieldLabel}>{k}</span>
              {i === 3 ? (
                <m.span
                  variants={{
                    hidden: { opacity: 0, scale: 0.85 },
                    show: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: EASE_PREMIUM } },
                  }}
                >
                  {v}
                </m.span>
              ) : (
                <span>{v}</span>
              )}
            </m.div>
          ))}
        </m.div>
      </div>
    </m.div>
  );
}

/** Camp block occupancy + a bus route. */
export function CampsVisual() {
  const rooms = [
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 0, 0],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1],
  ];
  return (
    <m.div className={`${s.diveVisual} ${s["tint-mint"]}`} aria-hidden {...inView}>
      <div className={s.diveCard}>
        <div className={s.stepLine}>
          <b>Sonapur Camp · Block C</b>
          <span className={`${s.tag} ${s.tagGreen}`}>81% occupied</span>
        </div>
        <div className={s.bar}>
          <m.span variants={{ hidden: { width: "0%" }, show: { width: "81%", transition: { duration: 0.9, ease: EASE_PREMIUM, delay: 0.1 } } }} />
        </div>
        <m.div className={s.rooms} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.3 } } }}>
          {rooms.map((beds, i) => (
            <m.div key={i} className={s.room} variants={fieldVariant}>
              C-{101 + i}
              <div className={s.beds}>
                {beds.map((b, j) => (
                  <span key={j} className={`${s.bed} ${b ? s.bedFull : ""}`} />
                ))}
              </div>
            </m.div>
          ))}
        </m.div>
        <m.div
          className={s.stepLine}
          style={{ marginTop: 16 }}
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.3, delay: 1.0 } } }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Bus size={14} />
            Route 4 · Sonapur
            <svg width="36" height="10" viewBox="0 0 36 10" style={{ overflow: "visible" }}>
              <m.path
                d="M0 5 H30"
                stroke="var(--teal)"
                strokeWidth="1.5"
                variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { duration: 0.6, ease: "easeInOut", delay: 1.1 } } }}
              />
              <m.circle
                cx="30"
                cy="5"
                r="2.5"
                fill="var(--teal)"
                variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2, delay: 1.7 } } }}
              />
            </svg>
            Al Quoz
          </span>
          <span className={s.miniMuted}>05:30 · 48 seats</span>
        </m.div>
      </div>
    </m.div>
  );
}

/** Assistant chat. */
export function AssistantVisual() {
  return (
    <m.div className={`${s.diveVisual} ${s["tint-lavender"]}`} aria-hidden {...inView}>
      <div className={`${s.diveCard} ${s.chat}`}>
        <m.div
          className={s.bubbleUser}
          variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_PREMIUM } } }}
        >
          Which visas expire in the next 30 days?
        </m.div>
        <m.div
          className={s.thinking}
          variants={{ hidden: { opacity: 0 }, show: { opacity: [0, 1, 1, 0], transition: { duration: 0.6, delay: 0.35, times: [0, 0.2, 0.8, 1] } } }}
          aria-hidden
        >
          <span />
          <span />
          <span />
        </m.div>
        <m.div
          className={s.bubbleBot}
          variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_PREMIUM, delay: 0.9 } } }}
        >
          7 employees have visas expiring before 30 June:
          <m.ul variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 1.25 } } }}>
            <m.li variants={fieldVariant}>
              <span className={s.linkish}>Rajesh Kumar</span> · 22 Jun
            </m.li>
            <m.li variants={fieldVariant}>
              <span className={s.linkish}>Joseph Santos</span> · 25 Jun
            </m.li>
            <m.li variants={fieldVariant}>
              <span className={s.linkish}>+5 more</span> in Documents
            </m.li>
          </m.ul>
        </m.div>
        <m.div
          className={s.bubbleUser}
          variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_PREMIUM, delay: 1.75 } } }}
        >
          Draft renewal NOCs for them.
        </m.div>
      </div>
    </m.div>
  );
}

/** Generic "rows in a card" visual — the shape most product screens reduce to. */
function RowsVisual({
  tint,
  heading,
  badge,
  badgeTone = "tagGreen",
  rows,
  footer,
}: {
  tint: string;
  heading: string;
  badge?: string;
  badgeTone?: "tagGreen" | "tagBlue" | "tagOrange" | "tagPurple" | "tagRose";
  rows: { label: React.ReactNode; value: React.ReactNode }[];
  footer?: { label: React.ReactNode; value: React.ReactNode };
}) {
  return (
    <m.div className={`${s.diveVisual} ${s[tint]}`} aria-hidden {...inView}>
      <div className={s.diveCard}>
        <div className={s.stepLine}>
          <b>{heading}</b>
          {badge && <span className={`${s.tag} ${s[badgeTone]}`}>{badge}</span>}
        </div>
        <m.div
          style={{ marginTop: 12 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } } }}
        >
          {rows.map((r, i) => (
            <m.div key={i} className={s.field} variants={fieldVariant}>
              <span className={s.fieldLabel}>{r.label}</span>
              <span>{r.value}</span>
            </m.div>
          ))}
        </m.div>
        {footer && (
          <m.div
            className={s.stepLine}
            style={{ marginTop: 16, fontWeight: 600 }}
            variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, delay: 0.15 + rows.length * 0.1 } } }}
          >
            <span>{footer.label}</span>
            <span>{footer.value}</span>
          </m.div>
        )}
      </div>
    </m.div>
  );
}

/** Payroll run → WPS file. */
export function PayrollVisual() {
  return (
    <RowsVisual
      tint="tint-mint"
      heading="May 2026 payroll run"
      badge="Approved"
      rows={[
        { label: "Workers", value: "412" },
        { label: "Basic + allowances", value: "AED 1,142,300" },
        { label: "Overtime (6,930 h)", value: "AED 168,420" },
        { label: "Loan deductions", value: "−AED 26,160" },
        { label: "WPS / SIF file", value: <span className={`${s.tag} ${s.tagGreen}`}>Generated</span> },
      ]}
      footer={{ label: "Net pay", value: "AED 1,284,560" }}
    />
  );
}

/** Client invoice with VAT. */
export function InvoiceVisual() {
  return (
    <RowsVisual
      tint="tint-peach"
      heading="INV-2026-0418 · Northgate"
      badge="Sent"
      badgeTone="tagBlue"
      rows={[
        { label: "Steel fixers", value: "3,180 h × AED 42" },
        { label: "Masons", value: "2,460 h × AED 38" },
        { label: "Helpers", value: "4,020 h × AED 26" },
        { label: "Subtotal", value: "AED 610,185" },
        { label: "VAT 5%", value: "AED 30,509" },
      ]}
      footer={{ label: "Total due", value: "AED 640,694" }}
    />
  );
}

/** Demand request moving through its stages. */
export function DemandVisual() {
  const stages = [
    ["Enquiry received", "tagBlue", "Northgate · 40 masons"],
    ["Quotation sent", "tagPurple", "Q-1187 · AED 38/hr"],
    ["Approved", "tagGreen", "DR-231 · 40 of 40"],
    ["Mobilising", "tagOrange", "28 on site · 12 in process"],
  ] as const;
  return (
    <m.div className={`${s.diveVisual} ${s["tint-lavender"]}`} aria-hidden {...inView}>
      <div className={s.diveCard}>
        <div className={s.stepLine}>
          <b>DR-231 · Northgate Contracting</b>
          <span className={`${s.tag} ${s.tagOrange}`}>Mobilising</span>
        </div>
        <m.div
          style={{ marginTop: 14, display: "grid", gap: 10 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.14, delayChildren: 0.15 } } }}
        >
          {stages.map(([label, tone, detail], i) => (
            <m.div key={label} variants={fieldVariant} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: i === stages.length - 1 ? "var(--orange)" : "var(--green)",
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1 }}>
                <b style={{ fontWeight: 600 }}>{label}</b>
                <span className={s.miniMuted} style={{ display: "block", fontSize: 13 }}>
                  {detail}
                </span>
              </span>
              <span className={`${s.tag} ${s[tone]}`}>{i === stages.length - 1 ? "Now" : "Done"}</span>
            </m.div>
          ))}
        </m.div>
      </div>
    </m.div>
  );
}

/** Supplier portal: a demand, the supplier's quote, their workers. */
export function SupplierVisual() {
  return (
    <m.div className={`${s.diveVisual} ${s["tint-yellow"]}`} aria-hidden {...inView}>
      <div className={s.diveCard}>
        <div className={s.stepLine}>
          <b>Al Madina Manpower</b>
          <span className={`${s.tag} ${s.tagPurple}`}>Supplier portal</span>
        </div>
        <m.div
          style={{ marginTop: 12 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } } }}
        >
          <m.div className={s.field} variants={fieldVariant}>
            <span className={s.fieldLabel}>Demand</span>
            <span>DR-231 · 12 scaffolders</span>
          </m.div>
          <m.div className={s.field} variants={fieldVariant}>
            <span className={s.fieldLabel}>Their quote</span>
            <span>AED 34/hr · accepted</span>
          </m.div>
          <m.div className={s.field} variants={fieldVariant}>
            <span className={s.fieldLabel}>Workers sent</span>
            <span>
              12 submitted <span className={`${s.tag} ${s.tagGreen}`}>Approved</span>
            </span>
          </m.div>
          <m.div className={s.field} variants={fieldVariant}>
            <span className={s.fieldLabel}>Timesheet</span>
            <span>May · 2,304 h submitted</span>
          </m.div>
          <m.div className={s.field} variants={fieldVariant}>
            <span className={s.fieldLabel}>Payment</span>
            <span>
              AED 78,336 <span className={`${s.tag} ${s.tagBlue}`}>Scheduled</span>
            </span>
          </m.div>
        </m.div>
      </div>
    </m.div>
  );
}

/** Employee portal on a phone. */
export function EmployeePhoneVisual() {
  return (
    <m.div className={`${s.diveVisual} ${s["tint-rose"]}`} aria-hidden {...inView}>
      <m.div
        style={{
          width: 240,
          margin: "0 auto",
          background: "var(--canvas)",
          border: "1px solid var(--hairline)",
          borderRadius: 26,
          boxShadow: "var(--mock-shadow)",
          padding: 14,
        }}
        variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_PREMIUM } } }}
      >
        <div style={{ width: 54, height: 4, borderRadius: 999, background: "var(--hairline)", margin: "0 auto 14px" }} />
        <div style={{ fontSize: 13, color: "var(--steel)" }}>Payslip</div>
        <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>May 2026</div>
        <m.div
          style={{ marginTop: 12, fontSize: 13 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.25 } } }}
        >
          {[
            ["Days worked", "26"],
            ["Overtime", "18 h"],
            ["Basic", "AED 1,800"],
            ["Allowances", "AED 750"],
            ["Overtime pay", "AED 168"],
          ].map(([k, v]) => (
            <m.div key={k} className={s.miniRow} variants={fieldVariant}>
              <span className={s.miniMuted}>{k}</span>
              <span>{v}</span>
            </m.div>
          ))}
          <m.div
            className={s.miniRow}
            style={{ fontWeight: 600, borderTop: "1px solid var(--hairline-soft)", marginTop: 6, paddingTop: 10 }}
            variants={fieldVariant}
          >
            <span>Net pay</span>
            <span>AED 2,718</span>
          </m.div>
        </m.div>
      </m.div>
    </m.div>
  );
}

/** Timesheet rows with approval status — the shape of the core screen. */
export function TimesheetVisual() {
  const rows = [
    ["RK", "Rajesh Kumar", "Steel fixer", 208, 16, "Approved", "tagGreen", "var(--tint-peach)"],
    ["MA", "Mohammed Ali", "Mason", 208, 22, "Approved", "tagGreen", "var(--tint-sky)"],
    ["JS", "Joseph Santos", "Electrician", 196, 8, "Review OT", "tagOrange", "var(--tint-mint)"],
    ["SH", "Sanjay Hegde", "Welder", 212, 30, "Pending", "tagPurple", "var(--tint-lavender)"],
  ] as const;
  return (
    <m.div className={`${s.diveVisual} ${s["tint-sky"]}`} aria-hidden {...inView}>
      <div className={s.diveCard}>
        <div className={s.stepLine}>
          <b>May 2026 · Site 14</b>
          <span className={`${s.tag} ${s.tagBlue}`}>Ready to invoice</span>
        </div>
        <m.div
          style={{ marginTop: 12 }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } } }}
        >
          {rows.map(([initials, name, trade, hrs, ot, status, tone, bg]) => (
            <m.div
              key={name}
              className={s.miniRow}
              style={{ borderBottom: "1px solid var(--hairline-soft)" }}
              variants={fieldVariant}
            >
              <span className={s.person}>
                <span className={s.avatar} style={{ background: bg }}>
                  {initials}
                </span>
                <span>
                  {name}
                  <span className={s.miniMuted} style={{ display: "block", fontSize: 12 }}>
                    {trade}
                  </span>
                </span>
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <span className={s.miniMuted} style={{ fontSize: 12 }}>
                  {hrs} h · {ot} OT
                </span>
                <span className={`${s.tag} ${s[tone]}`}>{status}</span>
              </span>
            </m.div>
          ))}
        </m.div>
      </div>
    </m.div>
  );
}

/** Permissions matrix — module × action. */
export function PermissionsVisual() {
  const modules = ["Workforce", "Payroll", "Finance", "Demand"];
  const grants = [
    [1, 1, 0, 0],
    [1, 0, 0, 0],
    [0, 0, 0, 0],
    [1, 1, 1, 0],
  ];
  const actions = ["View", "Edit", "Approve", "Delete"];
  return (
    <m.div className={`${s.diveVisual} ${s["tint-gray"]}`} aria-hidden {...inView}>
      <div className={s.diveCard}>
        <div className={s.stepLine}>
          <b>Access role · Site Supervisor</b>
          <span className={`${s.tag} ${s.tagGreen}`}>Saved</span>
        </div>
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr repeat(4, 44px)", gap: "6px 4px", fontSize: 12 }}>
          <span />
          {actions.map((a) => (
            <span key={a} className={s.miniMuted} style={{ textAlign: "center", fontSize: 11 }}>
              {a}
            </span>
          ))}
          {modules.map((mod, r) => (
            <Row key={mod} label={mod} grants={grants[r]} rowIndex={r} />
          ))}
        </div>
      </div>
    </m.div>
  );
}

function Row({ label, grants, rowIndex }: { label: string; grants: number[]; rowIndex: number }) {
  return (
    <>
      <span style={{ alignSelf: "center", fontWeight: 500 }}>{label}</span>
      {grants.map((g, c) => (
        <m.span
          key={c}
          style={{
            height: 22,
            borderRadius: 6,
            display: "grid",
            placeItems: "center",
            background: g ? "var(--tint-mint)" : "var(--surface)",
            color: g ? "var(--teal)" : "var(--stone)",
            fontWeight: 600,
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.3, ease: EASE_PREMIUM, delay: 0.1 + (rowIndex * 4 + c) * 0.03 }}
        >
          {g ? "✓" : "–"}
        </m.span>
      ))}
    </>
  );
}

export const VISUALS = {
  documents: DocumentsVisual,
  camps: CampsVisual,
  assistant: AssistantVisual,
  payroll: PayrollVisual,
  invoice: InvoiceVisual,
  demand: DemandVisual,
  supplier: SupplierVisual,
  employee: EmployeePhoneVisual,
  timesheet: TimesheetVisual,
  permissions: PermissionsVisual,
} as const;

export type VisualName = keyof typeof VISUALS;

export function ProductVisual({ name }: { name: VisualName }) {
  const Visual = VISUALS[name];
  return <Visual />;
}
