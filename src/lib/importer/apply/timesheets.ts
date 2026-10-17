import { computeImportWarnings, parseConsolidatedWorkbook, type TimesheetOverrides } from "@/lib/parseTimesheet";
import { applyFixes, collectFixables } from "../fixes";
import { importParsedMonths } from "@/lib/importTimesheet";
import { nameKey } from "@/lib/partyCode";
import type { ApplyCtx, ApplyResult, BreakdownClient, BreakdownPerson, Fix, ImportNote, RowReport, SupplierDecision } from "../types";

/** Import a consolidated timesheet workbook: suppliers, sponsors, clients,
 * workers, the monthly timesheet rows, and the days as attendance. */
export async function applyTimesheets(
  ctx: ApplyCtx,
  file: { buffer: Buffer; filename: string },
  overrides: TimesheetOverrides = {},
  aliases: Record<string, string> = {},
  fixes: Fix[] = [],
  supplierDecisions: Record<string, SupplierDecision> = {},
): Promise<ApplyResult> {
  const parsed = await parseConsolidatedWorkbook(file.buffer, overrides);
  // Corrections typed in on the review screen replace what the sheet has, then the warnings are worked out again so a fixed problem stops being reported.
  applyFixes(parsed.months, fixes);
  const warn = computeImportWarnings(parsed.months);
  // Names the person said are an existing company or client: use the existing spelling, so no duplicate is made.
  const alias = new Map(Object.entries(aliases).map(([from, to]) => [nameKey(from), to]));
  if (alias.size > 0) {
    for (const m of parsed.months) {
      for (const e of m.entries) {
        e.supplierName = alias.get(nameKey(e.supplierName)) ?? e.supplierName;
        if (e.sponsorName) e.sponsorName = alias.get(nameKey(e.sponsorName)) ?? e.sponsorName;
        if (e.clientName) e.clientName = alias.get(nameKey(e.clientName)) ?? e.clientName;
      }
    }
  }
  // Workers the sheet gives no usable ID for carry a placeholder id made from their name. Where exactly one
  // existing worker in this branch has that name, the sheet's row is theirs: use their real ID rather than
  // creating a second record. Two with the same name are left alone and reported, never guessed.
  const matchedIds = new Set<string>();
  let matchedByName = 0;
  let ambiguousByName: string[] = [];
  let placeholderIds = 0;
  const placeholderEntries = parsed.months.flatMap((m) => m.entries).filter((e) => e.employeeIdNo.startsWith("NOID-"));
  if (placeholderEntries.length > 0) {
    const people = await ctx.db.employee.findMany({ where: { branchId: ctx.branchId }, select: { employeeIdNo: true, name: true } });
    const byName = new Map<string, string[]>();
    for (const p of people) byName.set(nameKey(p.name), [...(byName.get(nameKey(p.name)) ?? []), p.employeeIdNo]);
    const ambiguous = new Set<string>();
    for (const e of placeholderEntries) {
      const hits = byName.get(nameKey(e.employeeName)) ?? [];
      if (hits.length === 1) {
        e.employeeIdNo = hits[0];
        matchedIds.add(hits[0]);
        matchedByName++;
      } else {
        placeholderIds++;
        if (hits.length > 1) ambiguous.add(e.employeeName);
      }
    }
    ambiguousByName = [...ambiguous];
  }

  if (parsed.months.length === 0) {
    return {
      rows: [],
      counts: { created: 0, updated: 0, failed: 0 },
      notes: [{ tone: "warn", title: "No timesheet months found", detail: "Expected sheets named like \"Aug 26\" or \"MAY-25\", with an \"EMPLOYEE NAME\" (or \"NAME\") column." }],
    };
  }

  // Clients already on record, to tell the new ones from the existing ones in the review.
  const clientsBefore = new Set((await ctx.db.client.findMany({ where: { branchId: ctx.branchId }, select: { name: true } })).map((c) => nameKey(c.name)));

  const upload = await ctx.db.upload.create({
    data: { filename: file.filename, fileData: new Uint8Array(file.buffer), uploadedById: ctx.user.id, branchId: ctx.branchId },
  });
  const stats = await importParsedMonths(parsed.months, upload.id, ctx.branchId, null, {
    db: ctx.db,
    userId: ctx.user.id,
    progress: ctx.progress,
    supplierChoice: { decisions: supplierDecisions },
  });

  const rows: RowReport[] = stats.skippedRowDetails.map((r) => ({
    row: r.row,
    name: `${r.name} (${r.idNo})`,
    status: "error" as const,
    message: `${r.sheetName}: ${r.reason}`,
  }));

  const notes: ImportNote[] = [];
  for (const s of parsed.unrecognizedSheets) {
    notes.push({ tone: "info", title: `Sheet "${s}" was skipped`, detail: "Its name isn't a month (like \"Aug 26\") or it has no EMPLOYEE NAME column." });
  }
  for (const m of parsed.months) {
    for (const text of m.notes ?? []) notes.push({ tone: "info", title: `${m.sheetName}: ${text}` });
    if (m.blankMeansNotDeployed && m.entries.some((e) => e.dailyHours.some((d) => /^(W|HL|ND)$/i.test(d.value.trim())))) {
      const halfDay = m.entries.reduce((n, e) => n + e.dailyHours.filter((d) => d.value.trim().toUpperCase() === "HL").length, 0);
      notes.push({
        tone: "info",
        title: `${m.sheetName}: how the day cells were read`,
        detail: `W is the weekly off, H a holiday, SL sick leave, A absent, ND not deployed (idle, the same as a blank day), and HL half-day leave, counted as a leave day${halfDay > 0 ? ` (${halfDay} in this sheet)` : ""}: the half day worked is not paid separately. A blank day means not deployed: it is recorded as idle for any worker with at least one day filled in.`,
      });
    }
  }
  if (matchedByName > 0) {
    notes.push({ tone: "info", title: `${matchedByName} worker${matchedByName === 1 ? "" : "s"} with no ID on the sheet matched an existing worker by name`, detail: "Their days were added to the existing record." });
  }
  if (placeholderIds > 0) {
    notes.push({
      tone: "warn",
      title: `${placeholderIds} worker${placeholderIds === 1 ? " has" : "s have"} no ID on the sheet and no existing worker with that name`,
      detail: `They get a placeholder ID made from the name (NOID-…). Give them a real ID on their record later; the same placeholder is used each month, so no duplicates are made.${ambiguousByName.length > 0 ? ` Two or more existing workers share the name: ${ambiguousByName.slice(0, 5).join(", ")}.` : ""}`,
    });
  }
  if (warn.zeroRateCount > 0) {
    notes.push({
      tone: "warn",
      title: `${warn.zeroRateCount} rows have a rate of 0`,
      detail: `Usually a column heading that wasn't recognised. e.g. ${warn.zeroRateSample.slice(0, 3).map((w) => `${w.employeeName} (${w.employeeIdNo})`).join(", ")}`,
    });
  }
  if (warn.implausibleHoursCount > 0) {
    notes.push({
      tone: "warn",
      title: `${warn.implausibleHoursCount} days have an unusual hours value`,
      detail: `Negative or over 24 hours. e.g. ${warn.implausibleHoursSample.slice(0, 3).map((w) => `${w.employeeName}: ${w.detail}`).join("; ")}`,
    });
  }
  if ((stats.attendanceConflicts ?? 0) + (stats.attendanceLocked ?? 0) > 0) {
    notes.push({
      tone: "warn",
      title: `${(stats.attendanceConflicts ?? 0) + (stats.attendanceLocked ?? 0)} days already had attendance that differs`,
      detail: "They were left as they were. The sheet is never allowed to overwrite what a supervisor marked.",
    });
  }
  if ((stats.attendanceUnrecognised ?? 0) > 0) {
    notes.push({
      tone: "warn",
      title: `${stats.attendanceUnrecognised} cells weren't recognised as attendance`,
      detail: `Skipped: ${(stats.unrecognisedValues ?? []).join(", ")}. Recognised: hours, A, L / SL / SICK, H, OFF.`,
    });
  }
  if ((stats.nationalityNotSaved ?? 0) > 0) {
    notes.push({
      tone: "warn",
      title: `${stats.nationalityNotSaved} workers have a Nationality that isn't a country`,
      detail: `${(stats.nationalityNotSavedValues ?? []).join(", ")} — not saved. Use the country, e.g. India.`,
    });
  }
  if ((stats.nearMatches ?? []).length > 0) {
    notes.push({
      tone: "info",
      title: `${stats.nearMatches!.length} name${stats.nearMatches!.length === 1 ? " was" : "s were"} matched to an existing company or client`,
      detail: stats.nearMatches!.slice(0, 5).map((m) => `"${m.from}" → "${m.to}"`).join("; ") + ". Same name apart from LLC / Co / Ltd. If they are different companies, rename one first.",
    });
  }
  if ((stats.projectsNotFound ?? []).length > 0) {
    notes.push({
      tone: "warn",
      title: "Some projects in the sheet don't exist",
      detail: `${(stats.projectsNotFound ?? []).join(", ")} — those rows weren't linked to a project. Create the project first, or match its code or name exactly, then re-upload.`,
    });
  }
  if ((stats.workersLinkedToProject ?? 0) > 0) {
    notes.push({ tone: "info", title: `${stats.workersLinkedToProject} workers linked to their project`, detail: "From the Project column. A worker already on a project keeps it." });
  }
  if ((stats.weeklyOffSynced ?? []).length > 0) {
    const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    notes.push({
      tone: "info",
      title: `Weekly off updated on ${stats.weeklyOffSynced!.length} project${stats.weeklyOffSynced!.length === 1 ? "" : "s"} to match the sheet`,
      detail: stats.weeklyOffSynced!.slice(0, 5).map((w) => `${w.project}: ${w.from.map((d) => DAY[d]).join(", ") || "none"} → ${w.to.map((d) => DAY[d]).join(", ")}`).join("; ") + ". The days the sheet marks OFF are now the project's weekly off, so no day is counted off twice. Change it on the project if that is wrong.",
    });
  }
  if ((stats.payRatesSet ?? 0) > 0) {
    notes.push({ tone: "info", title: `${stats.payRatesSet} workers given a pay rate`, detail: "From the Pay Rate column (read by the Pay Structure column, or as hourly when there is none), for payroll. A rate already on file is never replaced." });
  }
  const months = parsed.months.map((m) => m.month);
  const drafts = await ctx.db.payrollRun.findMany({ where: { branchId: ctx.branchId, month: { in: months }, status: "DRAFT" }, select: { month: true } });
  if (drafts.length > 0) {
    notes.push({
      tone: "info",
      title: `Payroll drafts for ${[...new Set(drafts.map((d) => d.month))].join(", ")} need recalculating`,
      detail: "A draft run keeps the figures it had when it was built. Open it on the Payroll page and press Recalculate to pick up this timesheet and its attendance.",
    });
  }
  if (stats.rowsSkipped > stats.skippedRowDetails.length) {
    notes.push({ tone: "info", title: `${stats.rowsSkipped - stats.skippedRowDetails.length} rows left unchanged`, detail: "Timesheets that are already locked (invoiced) are never overwritten." });
  }

  // The file by client: who is in it, for which months, and what is new.
  const MAX_PEOPLE = 40;
  const byClient = new Map<string, { months: Map<string, { label: string; ids: Set<string> }>; people: Map<string, BreakdownPerson> }>();
  // What the person decided for a client name shapes what the review shows: "use existing" files its rows under that client.
  const clientRows = await ctx.db.client.findMany({ where: { branchId: ctx.branchId }, select: { id: true, name: true } });
  const clientNameById = new Map(clientRows.map((c) => [c.id, c.name]));
  const decidedFrom = new Map<string, string>();
  const resolveClient = (raw: string | null | undefined) => {
    const sheet = raw?.trim();
    if (!sheet) return "No client named";
    if (clientsBefore.has(nameKey(sheet))) return sheet;
    const d = supplierDecisions[`client:${nameKey(sheet)}`];
    if (d?.action === "existing") {
      const to = clientNameById.get(d.supplierId);
      if (to) { decidedFrom.set(nameKey(to), sheet); return to; }
    }
    if (d?.action === "add" && d.name?.trim()) return d.name.replace(/\s+/g, " ").trim();
    if (d?.action === "ignore") return "No client named";
    return sheet;
  };
  for (const m of parsed.months) {
    for (const e of m.entries) {
      const client = resolveClient(e.clientName);
      const group = byClient.get(client) ?? { months: new Map(), people: new Map() };
      const month = group.months.get(m.month) ?? { label: m.monthLabel, ids: new Set<string>() };
      month.ids.add(e.employeeIdNo);
      group.months.set(m.month, month);
      let days = 0;
      let hours = 0;
      for (const d of e.dailyHours) {
        const n = Number(d.value);
        if (Number.isFinite(n) && n > 0) { days++; hours += n; }
      }
      const person = group.people.get(e.employeeIdNo) ?? { name: e.employeeName, idNo: e.employeeIdNo, trade: e.trade, days: 0, hours: 0, ...(matchedIds.has(e.employeeIdNo) ? { note: "Matched by name" } : {}) };
      person.days += days;
      person.hours += hours;
      group.people.set(e.employeeIdNo, person);
      byClient.set(client, group);
    }
  }
  // A name the person pointed at an existing client ("use existing") counts as matched, like a near spelling.
  const nearFrom = new Map<string, string>([...decidedFrom.entries(), ...Object.entries(aliases).map(([from, to]) => [nameKey(to), from] as [string, string]), ...(stats.nearMatches ?? []).map((n) => [nameKey(n.to), n.from] as [string, string])]);
  const breakdownClients: BreakdownClient[] = [...byClient.entries()]
    .map(([name, g]) => {
      const people = [...g.people.values()].sort((a, b) => a.name.localeCompare(b.name));
      const from = nearFrom.get(nameKey(name));
      return {
        name,
        isNew: name !== "No client named" && !clientsBefore.has(nameKey(name)),
        ...(from && nameKey(from) !== nameKey(name) ? { matchedFrom: from } : {}),
        workers: people.length,
        months: [...g.months.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([month, v]) => ({ month, label: v.label, workers: v.ids.size })),
        people: people.slice(0, MAX_PEOPLE).map((p) => ({ ...p, hours: Math.round(p.hours * 10) / 10 })),
        hiddenPeople: Math.max(0, people.length - MAX_PEOPLE),
      };
    })
    .sort((a, b) => b.workers - a.workers);
  return {
    rows,
    notes,
    breakdown: { clients: breakdownClients, workers: new Set(parsed.months.flatMap((m) => m.entries.map((e) => e.employeeIdNo))).size, months: parsed.months.length },
    fixables: collectFixables(parsed.months),
    newSuppliers: stats.newSuppliers,
    existingSuppliers: stats.existingSuppliers,
    existingClients: stats.existingClients,
    counts: {
      created: stats.entriesCreated,
      updated: stats.entriesUpdated,
      failed: stats.skippedRowDetails.length,
      suppliersCreated: stats.suppliersCreated,
      clientsCreated: stats.clientsCreated,
      subsidiariesLinked: stats.subsidiariesLinked ?? 0,
      attendanceCreated: stats.attendanceCreated ?? 0,
      months: stats.monthsProcessed.length,
    },
  };
}
