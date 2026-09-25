/**
 * Realistic showcase data for the platform: clients, projects, suppliers,
 * ~36 workers, LPOs, enquiries and quotations, demand requests with offers and
 * allocations, two camps with beds and check-ins, vehicles and routes,
 * expenses and supplier bills (some waiting for approval).
 *
 * Every row it creates is recorded in prisma/scripts/demo-data-manifest.json, so
 * REMOVE=1 deletes exactly those rows and nothing else. Nothing existing is
 * modified. Payroll runs are deliberately not seeded.
 *
 * Read-only by default. Pass APPLY=1 to write.
 *   APPLY=1 npx tsx prisma/scripts/seed-demo-data.ts
 *   REMOVE=1 APPLY=1 npx tsx prisma/scripts/seed-demo-data.ts
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const APPLY = process.env.APPLY === "1";
const REMOVE = process.env.REMOVE === "1";
const MANIFEST = path.join(__dirname, "demo-data-manifest.json");

type Manifest = Record<string, string[]>;
const made: Manifest = {};
const track = (model: string, id: string) => {
  (made[model] ??= []).push(id);
  return id;
};

// Tiny deterministic PRNG so a re-run on a fresh database looks the same.
let seed = 20260925;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const day = 86_400_000;
const inDays = (n: number) => new Date(Date.now() + n * day);

// Delete order matters: children before parents.
const REMOVE_ORDER = [
  "billPayment", "supplierBill", "expense", "routeStop", "route", "campCheckIn", "bed", "room", "camp",
  "demandOfferLine", "demandSupplierOffer", "demandRequestAllocation", "demandRequestTrade", "demandRequest",
  "quotationLine", "quotation", "enquiry", "lpo", "employee", "vehicleProject", "vehicle", "projectContact",
  "project", "clientContact", "client", "supplier",
];

async function remove() {
  if (!fs.existsSync(MANIFEST)) return console.log("No manifest found; nothing to remove.");
  const m: Manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  for (const model of REMOVE_ORDER) console.log(`${model}: ${m[model]?.length ?? 0}`);
  if (!APPLY) return console.log("Dry run. Pass APPLY=1 to delete.");
  const p = prisma as unknown as Record<string, { deleteMany: (a: unknown) => Promise<{ count: number }> }>;
  for (const model of REMOVE_ORDER) {
    const ids = m[model];
    if (ids?.length) await p[model].deleteMany({ where: { id: { in: ids } } });
  }
  fs.unlinkSync(MANIFEST);
  console.log("Demo data removed.");
}

const NAMES: Record<string, string[]> = {
  India: ["Ajay Kumar", "Ramesh Yadav", "Suresh Patel", "Mohammed Irfan", "Vikram Singh", "Anil Sharma", "Rajesh Nair", "Sanjay Verma", "Deepak Mishra", "Manoj Tiwari"],
  Pakistan: ["Imran Khan", "Bilal Ahmed", "Usman Ali", "Zubair Hussain", "Tariq Mahmood", "Faisal Iqbal"],
  Bangladesh: ["Rahim Uddin", "Kamal Hossain", "Jahid Alam", "Sohel Rana", "Abdul Karim", "Shafiqul Islam"],
  Nepal: ["Bikram Thapa", "Ram Bahadur", "Suman Gurung", "Dipak Rai", "Krishna Magar"],
  Philippines: ["Jose Santos", "Mark Reyes", "Rodel Cruz", "Emmanuel Garcia"],
  Egypt: ["Ahmed Hassan", "Mahmoud Saeed", "Khaled Ibrahim"],
};
const TRADES = ["Helper", "Mason", "Steel Fixer", "Shuttering Carpenter", "Scaffolder", "Painter", "Electrician", "Plumber", "ARC Welder", "Rigger", "Tile Mason"];

async function main() {
  if (REMOVE) return remove();
  if (fs.existsSync(MANIFEST)) throw new Error("A demo-data manifest already exists — run REMOVE=1 first.");

  const branch = await prisma.branch.findUnique({ where: { code: "MAIN" } });
  if (!branch) throw new Error("MAIN branch not found.");
  const user = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  if (!user) throw new Error("No super admin user found.");
  const ownSupplier = await prisma.supplier.findFirst({ where: { code: "SUP001" } });

  console.log("Will create ~5 clients, 6 projects, 3 suppliers, 36 workers, 4 LPOs, 6 enquiries, 5 quotations, 6 demands, 2 camps, 4 vehicles, 8 expenses, 6 bills.");
  if (!APPLY) return console.log("Dry run. Pass APPLY=1 to create.");

  // ---------- clients
  const clientDefs = [
    ["Emaar Construction LLC", "DEMO-C1", "Rashid Al Mansoori", "rashid@emaar-demo.ae", "+971501112233", 32],
    ["Dubai Metro Works JV", "DEMO-C2", "Priya Menon", "priya@dmw-demo.ae", "+971502223344", 30],
    ["Al Futtaim Engineering", "DEMO-C3", "Omar Khalid", "omar@alfutt-demo.ae", "+971503334455", 45],
    ["Nakheel Infrastructure", "DEMO-C4", "Sara Ahmed", "sara@nakheel-demo.ae", "+971504445566", 30],
    ["Sobha Realty Projects", "DEMO-C5", "Vinod Kapoor", "vinod@sobha-demo.ae", "+971505556677", 60],
  ] as const;
  const clients = [];
  for (const [name, code, person, email, phone, terms] of clientDefs) {
    const c = await prisma.client.create({
      data: {
        name, code, branchId: branch.id, contactPerson: person, contactEmail: email, contactPhone: phone,
        basicRate: 1800 + Math.floor(rnd() * 600), hourlyRate: 9 + Math.floor(rnd() * 5),
        contractStart: inDays(-200), contractEnd: inDays(120 + Math.floor(rnd() * 240)),
        paymentTerms: `Net ${terms}`, emirate: "Dubai", country: "United Arab Emirates", trn: `1000${Math.floor(rnd() * 1e11)}`,
      },
    });
    track("client", c.id);
    const cc = await prisma.clientContact.create({ data: { clientId: c.id, name: person, designation: "Procurement Manager", phone, email } });
    track("clientContact", cc.id);
    clients.push(c);
  }

  // ---------- suppliers
  const supDefs = [
    ["Gulf Manpower Services", "DEMO-S1", "Approved", inDays(200)],
    ["Al Noor Labour Supply", "DEMO-S2", "Approved", inDays(18)],
    ["Emirates Skilled Workforce", "DEMO-S3", "Pending", inDays(-12)],
  ] as const;
  const suppliers = [];
  for (const [name, code, appr, lic] of supDefs) {
    const s = await prisma.supplier.create({
      data: {
        name, code, branchId: branch.id, contactPerson: pick(["Hamza Siddiqui", "Nadia Farooq", "Yusuf Rahman"]),
        contactPhone: `+9715${Math.floor(1e7 + rnd() * 9e7)}`, contactEmail: `ops@${code.toLowerCase()}-demo.ae`,
        status: "ACTIVE", approvalStatus: appr, labourApprovalStatus: appr, invoiceApprovalStatus: appr === "Approved" ? "Approved" : "Pending",
        tradeLicenseNumber: `TL-${Math.floor(100000 + rnd() * 899999)}`, tradeLicenseExpiry: lic, category: "Manpower supply", paymentTerms: "Net 30",
      },
    });
    track("supplier", s.id);
    suppliers.push(s);
  }

  // ---------- projects
  const people = [
    ["Farhan Qureshi", "+971521110001", "farhan.q@demo.ae"], ["Lina Haddad", "+971521110002", "lina.h@demo.ae"],
    ["George Mathew", "+971521110003", "george.m@demo.ae"], ["Aisha Rahman", "+971521110004", "aisha.r@demo.ae"],
  ] as const;
  const projDefs = [
    ["Creek Harbour Tower 3", 0, 40, "ACTIVE"], ["Metro Line Extension — Zone B", 1, 60, "ACTIVE"],
    ["Business Bay Mall Fit-out", 2, 25, "ACTIVE"], ["Palm Villas Phase 2", 3, 30, "ACTIVE"],
    ["Sobha Hartland Block C", 4, 50, "PLANNING"], ["Airport Road Warehouse", 2, 12, "ON_HOLD"],
  ] as const;
  const projects = [];
  for (let i = 0; i < projDefs.length; i++) {
    const [name, ci, req, status] = projDefs[i];
    const [pm, pmPh, pmEm] = people[i % 4];
    const [co, coPh, coEm] = people[(i + 1) % 4];
    const [se, sePh, seEm] = people[(i + 2) % 4];
    const p = await prisma.project.create({
      data: {
        code: `DEMO-P${i + 1}`, name, clientId: clients[ci].id, branchId: branch.id, status,
        timelineStart: inDays(-90 + i * 10), timelineEnd: inDays(i === 5 ? -8 : 60 + i * 45), noOfEmployeesRequired: req,
        manager: pm, managerPhone: pmPh, managerEmail: pmEm, projectCoordinator: co, projectCoordinatorPhone: coPh, projectCoordinatorEmail: coEm,
        salesExecutive: se, salesExecutivePhone: sePh, salesExecutiveEmail: seEm, address: "Dubai, UAE",
      },
    });
    track("project", p.id);
    projects.push(p);
  }

  // ---------- LPOs
  for (let i = 0; i < 4; i++) {
    const value = 150000 + Math.floor(rnd() * 350000);
    const l = await prisma.lpo.create({
      data: {
        lpoNumber: `DEMO-LPO-${1000 + i}`, value, billedAmount: Math.round(value * (0.2 + rnd() * 0.6)), quantity: 20 + i * 8, trade: TRADES[i],
        validFrom: inDays(-120), validTo: inDays(90 + i * 30), status: "ACTIVE", projectId: projects[i].id, clientId: projects[i].clientId, branchId: branch.id,
      },
    });
    track("lpo", l.id);
  }

  // ---------- vehicles and routes
  const vDefs = [
    ["DXB A 48213", "Bus", 50, "Mustafa Ali", -1, "ACTIVE"], ["DXB K 90127", "Hiace Van", 14, "Rizwan Ahmad", 20, "ACTIVE"],
    ["SHJ 7 33481", "Bus", 50, "Naseer Khan", 200, "MAINTENANCE"], ["DXB B 15570", "Pickup", 4, "Salim Reza", 90, "ACTIVE"],
  ] as const;
  const vehicles = [];
  for (const [plate, type, cap, driver, regDays, status] of vDefs) {
    const v = await prisma.vehicle.create({
      data: { plateNumber: plate, type, capacity: cap, driverName: driver, driverPhone: `+9715${Math.floor(1e7 + rnd() * 9e7)}`, registrationExpiry: inDays(regDays), insuranceExpiry: inDays(regDays + 120), status },
    });
    track("vehicle", v.id);
    vehicles.push(v);
  }
  for (let i = 0; i < 2; i++) {
    const r = await prisma.route.create({ data: { name: `${["Morning", "Evening"][i]} run — ${projects[i].name}`, vehicleId: vehicles[i].id, projectId: projects[i].id } });
    track("route", r.id);
    for (const [order, loc, time] of [[1, "Camp B — Sonapur", "05:30"], [2, "Camp A — Al Quoz", "05:50"], [3, projects[i].name, "06:30"]] as const) {
      const st = await prisma.routeStop.create({ data: { routeId: r.id, location: loc, stopOrder: order, pickupTime: time } });
      track("routeStop", st.id);
    }
  }

  // ---------- workers
  const supplierPool = [ownSupplier?.id ?? null, suppliers[0].id, suppliers[1].id, suppliers[2].id];
  const nats = Object.keys(NAMES);
  const employees: { id: string; projectId: string | null; trade: string }[] = [];
  let n = 1;
  for (const nat of nats) {
    for (const nm of NAMES[nat]) {
      const trade = pick(TRADES);
      const status = pick(["ACTIVE", "ACTIVE", "ACTIVE", "ON_SITE", "IDLE", "UNDER_MOBILISATION", "ON_VACATION"] as const);
      const deployed = status === "ON_SITE" || status === "ACTIVE" || status === "UNDER_MOBILISATION";
      const project = deployed ? pick(projects.slice(0, 5)) : null;
      const exp = (lo: number, hi: number) => inDays(lo + Math.floor(rnd() * (hi - lo)));
      const e = await prisma.employee.create({
        data: {
          employeeIdNo: `DM-${String(n).padStart(4, "0")}`, name: nm, trade, nationality: nat, category: "SITE_STAFF", status,
          branchId: branch.id, supplierId: pick(supplierPool), projectId: project?.id ?? null,
          mobileNumber: `+9715${Math.floor(1e7 + rnd() * 9e7)}`, passportNumber: `P${Math.floor(1e6 + rnd() * 9e6)}`,
          emiratesId: `784-19${80 + (n % 20)}-${Math.floor(1e6 + rnd() * 9e6)}-${n % 9}`,
          visaExpiry: n % 9 === 0 ? exp(-20, -1) : n % 7 === 0 ? exp(5, 28) : exp(60, 500),
          laborCardExpiry: n % 11 === 0 ? exp(3, 25) : exp(70, 480), medicalExpiry: exp(40, 400),
          passportExpiry: exp(200, 1500), emiratesIdExpiry: exp(45, 700),
          payStructure: "HOURLY", hourlyRate: 6 + Math.floor(rnd() * 8), vehicleId: rnd() > 0.55 ? pick(vehicles).id : null,
        },
      });
      track("employee", e.id);
      employees.push({ id: e.id, projectId: project?.id ?? null, trade });
      n++;
    }
  }

  // ---------- camps: rooms, beds, check-ins
  const campIds: { id: string; beds: string[] }[] = [];
  for (const cname of ["Camp A — Al Quoz", "Camp B — Sonapur"]) {
    const camp = await prisma.camp.create({ data: { name: cname, ownerType: "OWN" } });
    track("camp", camp.id);
    const beds: string[] = [];
    for (let r = 1; r <= 5; r++) {
      const room = await prisma.room.create({ data: { campId: camp.id, name: `Room ${r}`, bedSpace: 6, usableBedSpace: 6, roomType: "Shared" } });
      track("room", room.id);
      for (let b = 1; b <= 6; b++) {
        const bed = await prisma.bed.create({ data: { roomId: room.id, label: `Bed ${String(b).padStart(2, "0")}` } });
        track("bed", bed.id);
        beds.push(bed.id);
      }
    }
    campIds.push({ id: camp.id, beds });
  }
  const housed = employees.slice(0, 24);
  for (let i = 0; i < housed.length; i++) {
    const camp = campIds[i % 2];
    const bedId = camp.beds.shift()!;
    const ci = await prisma.campCheckIn.create({
      data: { employeeId: housed[i].id, campId: camp.id, status: "BED_ALLOCATED", checkInDate: inDays(-(5 + Math.floor(rnd() * 80))), bedId, branchId: branch.id },
    });
    track("campCheckIn", ci.id);
    await prisma.bed.update({ where: { id: bedId }, data: { employeeId: housed[i].id } });
  }

  // ---------- sales: enquiries and quotations
  const enqDefs = [
    [0, "Steel Fixer", "Creek Harbour Tower 4", "Email", "Open", 3], [1, "Electrician", "Metro Zone C", "WhatsApp", "Quoted", 9],
    [2, "Painter", "Mall Level 3 finishing", "Phone call", "Open", 12], [3, "Mason", "Palm Villas Phase 3", "Referral", "Converted", 30],
    [4, "Scaffolder", "Hartland Block D", "Email", "Lost", 45], [0, "Helper", "Tower 3 general labour", "Website", "Quoted", 6],
  ] as const;
  const enquiries = [];
  for (const [ci, trade, hint, source, status, age] of enqDefs) {
    const e = await prisma.enquiry.create({
      data: { clientId: clients[ci].id, branchId: branch.id, requiredTrade: trade, projectHint: hint, source, status, remarks: `${Math.floor(8 + rnd() * 40)} workers needed, start within 2 weeks.`, createdAt: inDays(-age) },
    });
    track("enquiry", e.id);
    enquiries.push(e);
  }
  const quoDefs = [
    [1, 1, "SENT", 14, [["Electrician", 12, 11.5]]], [5, 0, "NEGOTIATION", 5, [["Helper", 30, 8.5], ["Mason", 10, 10.5]]],
    [3, 3, "ACCEPTED", -3, [["Mason", 25, 10.5], ["Steel Fixer", 10, 11]]], [1, 2, "DRAFT", 20, [["Painter", 8, 9.5]]],
    [4, 4, "REJECTED", -20, [["Scaffolder", 15, 10]]],
  ] as const;
  let qn = 1;
  for (const [enqIdx, ci, status, valid, lines] of quoDefs) {
    const q = await prisma.quotation.create({
      data: {
        quotationNumber: `DEMO-Q-${String(qn++).padStart(3, "0")}`, status, validUntil: inDays(valid), clientId: clients[ci].id, branchId: branch.id,
        enquiryId: enquiries[enqIdx].id, createdById: user.id,
        lines: { create: lines.map(([trade, quantity, rate]) => ({ trade, quantity, rate, otRate: rate * 1.25 })) },
      },
      include: { lines: { select: { id: true } } },
    });
    track("quotation", q.id);
    q.lines.forEach((l) => track("quotationLine", l.id));
  }

  // ---------- demand requests with offers and allocations
  const demandDefs = [
    [0, "Open", "High", [["Steel Fixer", 10, null], ["Helper", 6, null]], 0], [1, "Approved", "Medium", [["Electrician", 8, 6]], 1],
    [2, "Approved", "Medium", [["Painter", 12, 12], ["Helper", 4, 4]], 2], [3, "Open", "Low", [["Mason", 6, null]], 0],
    [0, "Closed", "Low", [["Scaffolder", 5, 5]], 2], [4, "Rejected", "Medium", [["Rigger", 3, 0]], 0],
  ] as const;
  for (const [pi, status, priority, trades, offers] of demandDefs) {
    const project = projects[pi];
    const d = await prisma.demandRequest.create({
      data: { clientId: project.clientId, projectId: project.id, branchId: branch.id, status, priority, requestType: "New", requestedById: user.id, createdAt: inDays(-Math.floor(rnd() * 20)) },
    });
    track("demandRequest", d.id);
    for (const [trade, quantity, approved] of trades) {
      const t = await prisma.demandRequestTrade.create({ data: { demandRequestId: d.id, trade, quantity, approvedQuantity: approved, shift: "Day", rate: 9 + Math.floor(rnd() * 4) } });
      track("demandRequestTrade", t.id);
      const candidates = employees.filter((e) => e.trade === trade).slice(0, Math.min(approved ?? 0, 4));
      for (const c of candidates) {
        const a = await prisma.demandRequestAllocation.create({ data: { demandRequestTradeId: t.id, employeeId: c.id } });
        track("demandRequestAllocation", a.id);
      }
    }
    for (let o = 0; o < offers; o++) {
      const off = await prisma.demandSupplierOffer.create({ data: { demandRequestId: d.id, supplierId: suppliers[o].id, status: o === 0 ? "ACCEPTED" : "SENT", sentById: user.id } });
      track("demandSupplierOffer", off.id);
    }
  }

  // ---------- expenses
  const expDefs = [
    ["Fuel", "Diesel for camp generator", 850, "PENDING"], ["Site supplies", "PPE reorder — gloves and goggles", 2340, "PENDING"],
    ["Transport", "Bus hire for site visit", 1200, "APPROVED"], ["Office", "Printer toner", 310, "APPROVED"],
    ["Maintenance", "Camp AC servicing", 1750, "APPROVED"], ["Meals", "Client lunch meeting", 460, "REJECTED"],
    ["Government fees", "Labour card renewals batch", 5800, "APPROVED"], ["Travel", "Airport pickup for new arrivals", 640, "PENDING"],
  ] as const;
  for (let i = 0; i < expDefs.length; i++) {
    const [category, description, amount, status] = expDefs[i];
    const ex = await prisma.expense.create({
      data: {
        date: inDays(-(2 + i * 3)), category, description, amount, vatAmount: Math.round(amount * 0.05), paymentMethod: i % 2 ? "CARD" : "CASH", status,
        submittedById: user.id, branchId: branch.id, projectId: i % 3 === 0 ? projects[0].id : null, reference: `DEMO-EXP-${i + 1}`,
        ...(status !== "PENDING" ? { decidedById: user.id, decidedAt: new Date() } : {}),
      },
    });
    track("expense", ex.id);
  }

  // ---------- supplier bills
  const billDefs = [
    [0, "PENDING", 12500, -5, 20], [0, "APPROVED", 18400, 10, -20], [1, "APPROVED", 9200, -18, -48], [1, "PENDING", 15100, 20, 0],
    [2, "APPROVED", 7600, -40, -70], [0, "APPROVED", 22000, 25, -5],
  ] as const;
  for (let i = 0; i < billDefs.length; i++) {
    const [si, approval, amount, dueOffset, billOffset] = billDefs[i];
    const b = await prisma.supplierBill.create({
      data: {
        billNo: `DEMO-BILL-${100 + i}`, billDate: inDays(billOffset - 10), dueDate: inDays(dueOffset), amount, vatAmount: Math.round(amount * 0.05),
        description: "Labour supply for the month", approvalStatus: approval, supplierId: suppliers[si].id, branchId: branch.id,
        periodMonth: new Date().toISOString().slice(0, 7),
      },
    });
    track("supplierBill", b.id);
    if (approval === "APPROVED" && i % 2 === 1) {
      const pay = await prisma.billPayment.create({ data: { billId: b.id, paidOn: inDays(-3), amount: Math.round(amount * 0.5), method: "BANK", reference: `DEMO-TRF-${i}`, createdById: user.id } });
      track("billPayment", pay.id);
    }
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(made, null, 1));
  console.log("Done:", Object.fromEntries(Object.entries(made).map(([k, v]) => [k, v.length])));
}

main()
  .catch((e) => {
    // A partial run still leaves a manifest, so it can be cleaned up.
    if (Object.keys(made).length) fs.writeFileSync(MANIFEST, JSON.stringify(made, null, 1));
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
