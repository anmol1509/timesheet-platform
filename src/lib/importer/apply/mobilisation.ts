import { nameKey } from "@/lib/partyCode";
import { uniqueClientCode } from "@/lib/entityCode";
import { exactKey, nameSimilarity, rankCandidates } from "../workerMatch";
import { readRosterDates } from "../rosterDates";
import type { ApplyCtx, ApplyResult, DeploymentRow, ImportNote, MappedRow, NewSupplier, PlacementIssue, RowReport, SupplierDecision, WorkerChoice } from "../types";
import { auditor, clean } from "./shared";

type Stage = "UNDER_MOBILISATION" | "ON_SITE" | "ACTIVE" | "BENCH";
const STAGE_LABEL: Record<Stage, string> = { UNDER_MOBILISATION: "Under mobilisation", ON_SITE: "On site", ACTIVE: "Active", BENCH: "Bench" };

function stageOf(raw: string): Stage | "" | null {
  const t = clean(raw).toLowerCase();
  if (!t) return "";
  if (/under|mobili[sz]|pending|awaiting/.test(t)) return "UNDER_MOBILISATION";
  if (/on[\s-]*site|arrived|reached/.test(t)) return "ON_SITE";
  if (/active|working|deployed|on the job|on job/.test(t)) return "ACTIVE";
  if (/bench|idle|available|free/.test(t)) return "BENCH";
  return null;
}

async function nextProjectCode(db: ApplyCtx["db"], taken: Set<string>) {
  let n = await db.project.count();
  for (;;) {
    n++;
    const code = `PRJ${String(n).padStart(3, "0")}`;
    if (!taken.has(code.toLowerCase())) { taken.add(code.toLowerCase()); return code; }
  }
}

/**
 * Import current deployments: which client and project each worker is on, and at what stage.
 * For moving a company's existing placements onto the platform, so it does not create or
 * touch demands. A worker already on that project at that stage with those dates is left alone.
 */
export async function applyMobilisation(
  ctx: ApplyCtx,
  input: MappedRow[],
  workerDecisions: Record<string, WorkerChoice> = {},
  partyDecisions: Record<string, SupplierDecision> = {},
  options: { defaultDate?: string } = {},
): Promise<ApplyResult> {
  const { db, branchId } = ctx;
  const audit = auditor(ctx);
  const rows: RowReport[] = [];
  const deployments: DeploymentRow[] = [];
  const notes: ImportNote[] = [];
  const counts = { updated: 0, unchanged: 0, workersCreated: 0, clientsCreated: 0, projectsCreated: 0, datesCorrected: 0, skipped: 0, needDecision: 0, failed: 0 };

  const [branch, clients, projects, roster] = await Promise.all([
    db.branch.findUnique({ where: { id: branchId }, select: { name: true } }),
    db.client.findMany({ where: { branchId }, select: { id: true, name: true } }),
    db.project.findMany({ where: { branchId }, select: { id: true, name: true, code: true, clientId: true } }),
    db.employee.findMany({ where: { branchId }, select: { id: true, name: true, employeeIdNo: true, trade: true, status: true, projectId: true, mobilisationDate: true, siteArrivalDate: true } }),
  ]);
  const clientByKey = new Map(clients.map((c) => [nameKey(c.name), c]));
  const projectByCode = new Map(projects.map((p) => [p.code.toLowerCase(), p]));
  const takenCodes = new Set(projects.map((p) => p.code.toLowerCase()));
  const byId = new Map(roster.map((p) => [p.id, p]));
  const byCode = new Map(roster.map((p) => [p.employeeIdNo.toLowerCase(), p]));
  const byName = new Map<string, typeof roster>();
  for (const p of roster) byName.set(exactKey(p.name), [...(byName.get(exactKey(p.name)) ?? []), p]);

  // Dates, read together so a swapped day/month can be spotted across the column.
  const reads = readRosterDates(input.flatMap(({ values }) => [clean(values.mobilisedOn), clean(values.arrivedOn)]));
  counts.datesCorrected = reads.filter((d) => d.corrected).length;
  const fixed = reads.filter((d) => d.corrected);
  if (fixed.length) notes.push({ tone: "warn", title: `${fixed.length} date${fixed.length === 1 ? "" : "s"} looked day/month-swapped and ${fixed.length === 1 ? "was" : "were"} corrected`, detail: `Excel read some day-first dates the US way. Compared with the other dates in the file, these were read the other way: ${fixed.slice(0, 8).map((d) => `${d.original} → ${d.iso}`).join(", ")}${fixed.length > 8 ? "…" : ""}. Check them against your file.` });

  // Clients and projects named in the file that aren't on record are listed for a decision: add, use an existing one, or ignore.
  const newParties = new Map<string, NewSupplier>();
  const noteNew = (key: string, name: string, party: "client" | "project") => {
    const have = newParties.get(key);
    if (have) have.rows++;
    else newParties.set(key, { key, name, role: "supplier", rows: 1, party });
  };

  const clientFor = async (name: string): Promise<{ id: string; name: string } | null | "pending"> => {
    if (!name) return null;
    const key = `client:${nameKey(name)}`;
    const hit = clientByKey.get(nameKey(name));
    if (hit) return hit;
    noteNew(key, name, "client");
    const d = partyDecisions[key];
    if (!d) return "pending";
    if (d.action === "ignore") return null;
    if (d.action === "existing") return clients.find((c) => c.id === d.supplierId) ?? null;
    const finalName = clean(d.name) || name;
    const again = clientByKey.get(nameKey(finalName));
    if (again) return again;
    const created = await db.client.create({ data: { name: finalName, code: await uniqueClientCode(finalName, branchId, undefined, db), branchId } });
    const made = { id: created.id, name: created.name };
    clients.push(made); clientByKey.set(nameKey(created.name), made); counts.clientsCreated++;
    await audit({ entityType: "CLIENT", entityId: created.id, action: "CREATE", after: { name: finalName }, userId: ctx.user.id, userName: ctx.user.name, branchId });
    return made;
  };

  /** "PRJ003 — Downtown Residences Phase 2" (as exported) is the code and the name. */
  const splitProject = (raw: string) => {
    const m = raw.match(/^([A-Za-z]{2,6}\d+)\s*[—–-]\s*(.+)$/);
    return m ? { code: m[1], name: m[2].trim() } : { code: "", name: raw };
  };
  const projectFor = async (raw: string, client: { id: string; name: string } | null, fileClient: string): Promise<{ id: string; name: string; clientId: string } | null | "pending"> => {
    if (!raw) return null;
    const { code, name } = splitProject(raw);
    const byCodeHit = code ? projectByCode.get(code.toLowerCase()) : undefined;
    if (byCodeHit && (!client || byCodeHit.clientId === client.id)) return byCodeHit;
    const pool = client ? projects.filter((p) => p.clientId === client.id) : projects;
    const hits = pool.filter((p) => nameKey(p.name) === nameKey(name) || nameKey(p.name) === nameKey(raw));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return hits[0];
    if (!client) return null; // no client to attach a new project to
    const key = `project:${nameKey(fileClient)}|${nameKey(name)}`;
    noteNew(key, `${name} (${client.name})`, "project");
    const d = partyDecisions[key];
    if (!d) return "pending";
    if (d.action === "ignore") return null;
    if (d.action === "existing") return projects.find((p) => p.id === d.supplierId) ?? null;
    const finalName = clean(d.name) || name;
    const again = projects.find((p) => p.clientId === client.id && nameKey(p.name) === nameKey(finalName));
    if (again) return again;
    const created = await db.project.create({ data: { code: code && !takenCodes.has(code.toLowerCase()) ? (takenCodes.add(code.toLowerCase()), code.toUpperCase()) : await nextProjectCode(db, takenCodes), name: finalName, clientId: client.id, branchId, status: "ACTIVE" } });
    const made = { id: created.id, name: created.name, code: created.code, clientId: created.clientId };
    projects.push(made); projectByCode.set(created.code.toLowerCase(), made); counts.projectsCreated++;
    await audit({ entityType: "PROJECT", entityId: created.id, action: "CREATE", after: { name: finalName, clientId: client.id }, userId: ctx.user.id, userName: ctx.user.name, branchId });
    return made;
  };

  const issues = new Map<string, PlacementIssue>();
  const usedCodes = new Set<string>();
  let nextNo = 1;
  const freeCode = async (wanted: string) => {
    const free = async (c: string) => !byCode.has(c.toLowerCase()) && !usedCodes.has(c.toLowerCase()) && !(await db.employee.findUnique({ where: { employeeIdNo: c }, select: { id: true } }));
    if (wanted && (await free(wanted))) { usedCodes.add(wanted.toLowerCase()); return wanted; }
    for (;;) { const c = `NEW-${String(nextNo++).padStart(3, "0")}`; if (await free(c)) { usedCodes.add(c.toLowerCase()); return c; } }
  };

  let done = 0;
  let idx = -1;
  for (const { row, values } of input) {
    idx++;
    const label = clean(values.employee) || clean(values.employeeCode);
    const base = { row, fileName: label, client: clean(values.client) || null, project: clean(values.project) || null };
    const push = (r: Omit<DeploymentRow, "row" | "fileName" | "client" | "project">) => deployments.push({ ...base, ...r });
    try {
      if (!label) { rows.push({ row, status: "error", message: "Worker name or employee code is required." }); counts.failed++; continue; }
      const stageRaw = stageOf(values.stage ?? "");
      if (stageRaw === null) { rows.push({ row, name: label, status: "error", message: `Stage "${clean(values.stage)}" isn't Under mobilisation, On site, Active or Bench.` }); counts.failed++; continue; }

      const mob = reads[idx * 2], arr = reads[idx * 2 + 1];
      const defaultDate = options.defaultDate && /^\d{4}-\d{2}-\d{2}$/.test(options.defaultDate) ? options.defaultDate : null;
      const mobilisedOn = mob.iso ?? defaultDate;
      let arrivedOn = arr.iso;
      for (const [what, d] of [["Mobilised on", mob], ["Arrived on site", arr]] as const) if (d.invalid) notes.push({ tone: "warn", title: `Row ${row}: ${what} "${d.original}" isn't a date`, detail: "It was ignored." });
      if (mobilisedOn && arrivedOn && arrivedOn < mobilisedOn) notes.push({ tone: "warn", title: `Row ${row}: ${label} arrived before being mobilised`, detail: `${arrivedOn} is earlier than ${mobilisedOn}. Both were kept; check the file.` });

      // Client and project, each of which may need a decision.
      const clientRes = await clientFor(base.client ?? "");
      const clientOk = clientRes === "pending" ? "pending" : clientRes;
      const projectRes = clientOk === "pending" ? "pending" : await projectFor(base.project ?? "", clientOk, base.client ?? "");
      if (clientOk === "pending" || projectRes === "pending") { counts.needDecision++; push({ worker: null, stage: null, mobilisedOn, arrivedOn, status: "decide", note: "Needs a decision about a client or project not on record." }); continue; }
      const project = projectRes;
      if (base.project && !project) { counts.skipped++; push({ worker: null, stage: null, mobilisedOn, arrivedOn, status: "skipped", note: base.client && !clientOk ? "Client was ignored." : "Project wasn't found." }); rows.push({ row, name: label, status: "skipped", message: "Project wasn't found or was ignored." }); continue; }

      const stage: Stage | "" = stageRaw || (project ? (arrivedOn ? "ACTIVE" : "UNDER_MOBILISATION") : "");
      if (!stage || (stage !== "BENCH" && !project)) { counts.skipped++; push({ worker: null, stage: null, mobilisedOn, arrivedOn, status: "skipped", note: "No project and no stage, so nothing to set." }); continue; }
      if (stage === "UNDER_MOBILISATION") arrivedOn = null;
      if ((stage === "ON_SITE" || stage === "ACTIVE") && !arrivedOn) arrivedOn = mobilisedOn;

      // Who the worker is.
      const code = clean(values.employeeCode), name = clean(values.employee), key = exactKey(label);
      let person = null as (typeof roster)[number] | null;
      let create = false;
      const dec = workerDecisions[key];
      if (dec?.action === "skip") { counts.skipped++; push({ worker: null, stage: STAGE_LABEL[stage], mobilisedOn, arrivedOn, status: "skipped", note: "You chose to skip this worker." }); continue; }
      if (dec?.action === "create") create = true;
      else if (dec?.action === "use") person = byId.get(dec.employeeId) ?? null;
      else {
        const byC = code ? byCode.get(code.toLowerCase()) : undefined;
        if (byC && (!name || nameSimilarity(name, byC.name) >= 0.45)) person = byC;
        else {
          const exact = byName.get(exactKey(name || code)) ?? [];
          if (exact.length === 1 && name) person = exact[0];
          else {
            const kind: PlacementIssue["kind"] = exact.length > 1 ? "several" : "unknown";
            const cands = byC && name ? [byC] : exact.length > 1 ? exact : name ? rankCandidates(name, roster.map((p) => ({ id: p.id, name: p.name, employeeIdNo: p.employeeIdNo })), 6, 0.78).map((c) => byId.get(c.id)!).filter(Boolean) : [];
            const final: PlacementIssue["kind"] = cands.length && kind === "unknown" ? "close" : kind;
            const have = issues.get(key);
            if (have) have.rows.push(row);
            else issues.set(key, { key, fileName: label, rows: [row], camp: base.client ?? "", room: base.project ?? "", context: [base.client, base.project].filter(Boolean).join(" / "), kind: final, candidates: cands.map((p) => ({ id: p.id, name: p.name, code: p.employeeIdNo, trade: p.trade ?? null, supplier: null, housed: null, score: Math.round(nameSimilarity(name || code, p.name) * 100) / 100 })), ...(final === "unknown" ? { proposed: { code, codeFromFile: !!code, trade: clean(values.trade) || null, mobile: clean(values.mobile) || null } } : {}) });
            counts.needDecision++;
            push({ worker: null, stage: STAGE_LABEL[stage], mobilisedOn, arrivedOn, status: "decide", note: final === "several" ? "Several workers share this name." : final === "close" ? "No exact match; close ones found." : "Not on record." });
            continue;
          }
        }
      }
      if (create) {
        const c = await freeCode(code);
        const created = await db.employee.create({ data: { employeeIdNo: c, name: name || c, trade: clean(values.trade) || null, mobileNumber: clean(values.mobile) || null, branchId } });
        person = { id: created.id, name: created.name, employeeIdNo: created.employeeIdNo, trade: created.trade ?? null, status: created.status, projectId: null, mobilisationDate: null, siteArrivalDate: null };
        roster.push(person); byId.set(person.id, person); byCode.set(c.toLowerCase(), person);
        counts.workersCreated++;
      }
      if (!person) { counts.skipped++; push({ worker: null, stage: STAGE_LABEL[stage], mobilisedOn, arrivedOn, status: "skipped", note: "The worker you chose is no longer on record." }); continue; }
      if (person.status === "TERMINATED") { counts.skipped++; push({ worker: { name: person.name, code: person.employeeIdNo, trade: person.trade }, stage: STAGE_LABEL[stage], mobilisedOn, arrivedOn, status: "skipped", note: "This worker is terminated." }); continue; }

      const shape = { name: person.name, code: person.employeeIdNo, trade: person.trade };
      const toStatus = stage === "BENCH" ? "IDLE" : stage;
      const mobDate = mobilisedOn ? new Date(`${mobilisedOn}T00:00:00.000Z`) : null;
      const arrDate = arrivedOn && stage !== "BENCH" ? new Date(`${arrivedOn}T00:00:00.000Z`) : null;
      const newProjectId = stage === "BENCH" ? null : project!.id;
      const same = person.projectId === newProjectId && person.status === toStatus
        && (person.mobilisationDate?.toISOString().slice(0, 10) ?? null) === (mobDate ? mobilisedOn : null)
        && (person.siteArrivalDate?.toISOString().slice(0, 10) ?? null) === (arrDate ? arrivedOn : null);
      if (same) { counts.unchanged++; push({ worker: shape, stage: STAGE_LABEL[stage], mobilisedOn, arrivedOn, status: "unchanged", note: "Already set this way." }); continue; }

      const projectChanged = person.projectId !== newProjectId;
      const open = await db.employeeAssignmentHistory.findFirst({ where: { employeeId: person.id, demobilizedDate: null }, orderBy: { mobilizedDate: "desc" } });
      if (projectChanged || !open) {
        if (open && projectChanged) await db.employeeAssignmentHistory.update({ where: { id: open.id }, data: { demobilizedDate: mobDate ?? new Date(), demobilizationReason: stage === "BENCH" ? "Moved to the bench by import" : "Replaced by import" } });
        if (stage !== "BENCH") await db.employeeAssignmentHistory.create({ data: { employeeId: person.id, projectId: project!.id, projectName: project!.name, branchName: branch?.name ?? null, ...(mobDate ? { mobilizedDate: mobDate } : {}) } });
      }
      await db.employee.update({ where: { id: person.id }, data: { projectId: newProjectId, siteId: projectChanged ? null : undefined, status: toStatus, mobilisationDate: mobDate, siteArrivalDate: arrDate } });
      person.projectId = newProjectId; person.status = toStatus; person.mobilisationDate = mobDate; person.siteArrivalDate = arrDate;
      await audit({ entityType: "EMPLOYEE", entityId: person.id, action: "UPDATE", after: { projectId: newProjectId, status: toStatus, mobilisationDate: mobilisedOn, siteArrivalDate: arrivedOn, via: "mobilisation import" }, userId: ctx.user.id, userName: ctx.user.name, branchId });
      counts.updated++;
      push({ worker: shape, stage: STAGE_LABEL[stage], mobilisedOn, arrivedOn, status: "set" });
    } catch (e) {
      rows.push({ row, name: label || undefined, status: "error", message: e instanceof Error ? e.message : "Failed to import row." });
      counts.failed++;
    }
    await ctx.progress?.(++done, input.length);
  }

  rows.sort((a, b) => a.row - b.row);
  return {
    rows, counts, notes, deployments, placementIssues: [...issues.values()],
    newSuppliers: [...newParties.values()],
    existingSuppliers: [], existingClients: clients.slice(0, 300), existingProjects: projects.slice(0, 300).map((p) => ({ id: p.id, name: p.name })),
  };
}
