"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { addEvent, applyCredits, applySuspended, callCustomer, requireOwner, syncCustomer } from "@/lib/ownerServer";
import { CUSTOMER_STATUSES, invoiceAmounts, isValidCustomerCode, nextInvoiceNumber, outstanding } from "@/lib/owner";
import { loadCompanySetup, provisionCompany } from "@/lib/provisionCompany";

export type OwnerState = { error: string | null; ok?: boolean; inviteLink?: string; inviteExpires?: string; customerId?: string; message?: string };

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const money = (fd: FormData, k: string) => { const n = Number(text(fd, k).replace(/,/g, "")); return Number.isFinite(n) ? n : NaN; };
const whole = (fd: FormData, k: string) => { const n = Number(text(fd, k).replace(/,/g, "")); return Number.isInteger(n) ? n : NaN; };
const dateOrNull = (fd: FormData, k: string) => { const v = text(fd, k); const d = v ? new Date(`${v}T12:00:00Z`) : null; return d && !Number.isNaN(d.getTime()) ? d : null; };
const refresh = (id?: string) => { revalidatePath("/owner"); if (id) revalidatePath(`/owner/${id}`); };

/** Adds a customer: sets their workspace up (on this platform, or on their own deployment), gives their first administrator a one-time link, and records the customer. */
export async function createCustomerAction(_prev: OwnerState, fd: FormData): Promise<OwnerState> {
  const owner = await requireOwner();
  const code = text(fd, "code").toUpperCase();
  const name = text(fd, "name");
  const hosting = text(fd, "hosting") === "DEDICATED" ? "DEDICATED" : "SHARED";
  const contactEmail = text(fd, "contactEmail").toLowerCase();
  const adminName = text(fd, "adminName") || text(fd, "contactName") || name;
  const adminEmail = (text(fd, "adminEmail") || contactEmail).toLowerCase();
  const credits = whole(fd, "credits");
  const rate = money(fd, "aiRateAed");
  const price = money(fd, "planPriceAed");
  const appUrl = text(fd, "appUrl").replace(/\/$/, "");
  if (!name) return { error: "Enter the company name." };
  if (!isValidCustomerCode(code)) return { error: "The code is 2 to 10 capital letters or numbers, e.g. RKG." };
  if (!/^\S+@\S+\.\S+$/.test(contactEmail)) return { error: "Enter the customer's email address." };
  if (!Number.isFinite(credits) || credits < 0 || credits > 10_000_000) return { error: "Credits must be a whole number." };
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) return { error: "Enter what one credit is worth in AED, e.g. 0.01." };
  if (!Number.isFinite(price) || price < 0) return { error: "Enter the plan price, or 0." };
  if (hosting === "DEDICATED" && !/^(https:\/\/|http:\/\/localhost)[^\s/]+/i.test(appUrl)) return { error: "Enter their deployment address, starting with https://." };
  if (await prisma.customer.findUnique({ where: { code }, select: { id: true } })) return { error: `A customer with the code ${code} already exists.` };

  const setupFrom = text(fd, "templateBranchId");
  const setup = setupFrom ? await loadCompanySetup(setupFrom) : undefined;
  const base = { code, name, emirate: text(fd, "emirate") || null, adminName, adminEmail, credits, setup };
  let branchId: string | null = null;
  let inviteLink: string | undefined;
  let inviteExpires: string | undefined;
  if (hosting === "SHARED") {
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "") || "https://app.manpowersync.com";
    const res = await provisionCompany({ ...base, baseUrl });
    if ("error" in res) return { error: res.error };
    branchId = res.branchId; inviteLink = res.inviteLink; inviteExpires = res.inviteExpires.toISOString();
  } else {
    const r = await callCustomer({ code, appUrl }, "POST", "/api/owner/bootstrap", base);
    if (!r.ok) return { error: `Couldn't set up their deployment: ${r.error}` };
    const d = r.data as { inviteLink?: string; inviteExpires?: string };
    inviteLink = d.inviteLink; inviteExpires = d.inviteExpires;
  }
  const created = await prisma.customer.create({
    data: {
      code, name, hosting, branchId, appUrl: hosting === "DEDICATED" ? appUrl : null,
      supabaseRef: text(fd, "supabaseRef") || null, vercelProject: text(fd, "vercelProject") || null,
      contactName: text(fd, "contactName") || null, contactEmail, contactPhone: text(fd, "contactPhone") || null, address: text(fd, "address") || null,
      plan: text(fd, "plan") || "Standard", planPriceAed: price, billingCycle: text(fd, "billingCycle") === "YEARLY" ? "YEARLY" : "MONTHLY",
      renewsOn: dateOrNull(fd, "renewsOn"), aiMonthlyCredits: credits, aiRateAed: rate,
      status: CUSTOMER_STATUSES.includes(text(fd, "status") as never) ? text(fd, "status") : "TRIAL", notes: text(fd, "notes") || null,
    },
  });
  await addEvent(created.id, "CREATED", `Customer added (${hosting === "SHARED" ? "on this platform" : "own deployment"}). ${credits.toLocaleString("en-US")} AI credits a month.`, owner.name);
  await syncCustomer(created).catch(() => undefined);
  refresh();
  return { error: null, ok: true, customerId: created.id, inviteLink, inviteExpires };
}

/** Brings a company that already exists on this platform into the owner's list. */
export async function registerExistingAction(_prev: OwnerState, fd: FormData): Promise<OwnerState> {
  const owner = await requireOwner();
  const branchId = text(fd, "branchId");
  const contactEmail = text(fd, "contactEmail").toLowerCase();
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true, code: true, name: true, aiMonthlyCredits: true } });
  if (!branch) return { error: "Pick a company." };
  if (!/^\S+@\S+\.\S+$/.test(contactEmail)) return { error: "Enter the customer's email address." };
  if (await prisma.customer.findFirst({ where: { OR: [{ branchId }, { code: branch.code.slice(0, 10).toUpperCase() }] }, select: { id: true } })) return { error: "That company is already in the list." };
  const code = branch.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 10);
  if (!isValidCustomerCode(code)) return { error: "That company's code can't be used as a customer code." };
  const created = await prisma.customer.create({ data: { code, name: branch.name, hosting: "SHARED", branchId, contactEmail, contactName: text(fd, "contactName") || null, status: "ACTIVE", aiMonthlyCredits: branch.aiMonthlyCredits } });
  await addEvent(created.id, "CREATED", "Existing company added to the owner's list.", owner.name);
  await syncCustomer(created).catch(() => undefined);
  refresh();
  return { error: null, ok: true, customerId: created.id };
}

export async function updateCustomerAction(_prev: OwnerState, fd: FormData): Promise<OwnerState> {
  const owner = await requireOwner();
  const id = text(fd, "id");
  const c = await prisma.customer.findUnique({ where: { id } });
  if (!c) return { error: "Customer not found." };
  const contactEmail = text(fd, "contactEmail").toLowerCase();
  const price = money(fd, "planPriceAed");
  const rate = money(fd, "aiRateAed");
  if (!/^\S+@\S+\.\S+$/.test(contactEmail)) return { error: "Enter the customer's email address." };
  if (!Number.isFinite(price) || price < 0) return { error: "Enter the plan price, or 0." };
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) return { error: "Enter what one credit is worth in AED, e.g. 0.01." };
  const appUrl = text(fd, "appUrl").replace(/\/$/, "");
  if (c.hosting === "DEDICATED" && !/^(https:\/\/|http:\/\/localhost)[^\s/]+/i.test(appUrl)) return { error: "Their deployment address must start with https://." };
  await prisma.customer.update({
    where: { id },
    data: {
      name: text(fd, "name") || c.name, contactName: text(fd, "contactName") || null, contactEmail, contactPhone: text(fd, "contactPhone") || null,
      address: text(fd, "address") || null, trn: text(fd, "trn") || null, plan: text(fd, "plan") || "Standard", planPriceAed: price,
      billingCycle: text(fd, "billingCycle") === "YEARLY" ? "YEARLY" : "MONTHLY", renewsOn: dateOrNull(fd, "renewsOn"), aiRateAed: rate,
      notes: text(fd, "notes") || null, ...(c.hosting === "DEDICATED" ? { appUrl, supabaseRef: text(fd, "supabaseRef") || null, vercelProject: text(fd, "vercelProject") || null } : {}),
    },
  });
  await addEvent(id, "UPDATED", "Details updated.", owner.name);
  refresh(id);
  return { error: null, ok: true };
}

export async function syncCustomerAction(_prev: OwnerState, fd: FormData): Promise<OwnerState> {
  await requireOwner();
  const c = await prisma.customer.findUnique({ where: { id: text(fd, "id") } });
  if (!c) return { error: "Customer not found." };
  const r = await syncCustomer(c);
  refresh(c.id);
  return "error" in r ? { error: r.error } : { error: null, ok: true };
}

/** Adds credits for this month, or changes the monthly allowance. */
export async function creditsAction(_prev: OwnerState, fd: FormData): Promise<OwnerState> {
  const owner = await requireOwner();
  const c = await prisma.customer.findUnique({ where: { id: text(fd, "id") } });
  if (!c) return { error: "Customer not found." };
  const kind = text(fd, "kind");
  const credits = whole(fd, "credits");
  if (kind === "allowance") {
    if (!Number.isFinite(credits) || credits < 0 || credits > 10_000_000) return { error: "Enter a whole number of credits." };
    const r = await applyCredits(c, { setMonthly: credits }, owner.id);
    if ("error" in r) return { error: r.error };
    await addEvent(c.id, "CREDITS", `Monthly allowance set to ${credits.toLocaleString("en-US")} credits.`, owner.name);
  } else {
    if (!Number.isFinite(credits) || credits <= 0 || credits > 1_000_000) return { error: "Enter a whole number of credits above zero." };
    const note = text(fd, "note") || null;
    const r = await applyCredits(c, { grant: { credits, note } }, owner.id);
    if ("error" in r) return { error: r.error };
    await addEvent(c.id, "CREDITS", `${credits.toLocaleString("en-US")} credits added for this month${note ? ` (${note})` : ""}.`, owner.name);
  }
  refresh(c.id);
  return { error: null, ok: true };
}

/** Moves a customer between trial, active, suspended and left. Suspending locks their people out; moving back lets them in. */
export async function setStatusAction(_prev: OwnerState, fd: FormData): Promise<OwnerState> {
  const owner = await requireOwner();
  const c = await prisma.customer.findUnique({ where: { id: text(fd, "id") } });
  const status = text(fd, "status");
  if (!c) return { error: "Customer not found." };
  if (!CUSTOMER_STATUSES.includes(status as never)) return { error: "Pick a status." };
  if (status === "SUSPENDED" || c.status === "SUSPENDED") {
    const r = await applySuspended(c, status === "SUSPENDED");
    if ("error" in r) return { error: r.error };
  }
  await prisma.customer.update({ where: { id: c.id }, data: { status } });
  await addEvent(c.id, "STATUS", `Status changed to ${status.toLowerCase()}.`, owner.name);
  refresh(c.id);
  return { error: null, ok: true };
}

export async function createInvoiceAction(_prev: OwnerState, fd: FormData): Promise<OwnerState> {
  const owner = await requireOwner();
  const c = await prisma.customer.findUnique({ where: { id: text(fd, "id") }, select: { id: true, code: true } });
  if (!c) return { error: "Customer not found." };
  const amount = money(fd, "amount");
  const description = text(fd, "description");
  const dueDate = dateOrNull(fd, "dueDate");
  if (!description) return { error: "Say what the invoice is for." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the amount before VAT." };
  if (!dueDate) return { error: "Pick a due date." };
  const a = invoiceAmounts(amount, fd.get("vat") === "on" ? undefined : 0);
  const existing = await prisma.customerInvoice.findMany({ where: { number: { startsWith: `INV-${c.code}-` } }, select: { number: true } });
  const inv = await prisma.customerInvoice.create({ data: { customerId: c.id, number: nextInvoiceNumber(c.code, existing.map((e) => e.number)), dueDate, description, subtotal: a.subtotal, vat: a.vat, total: a.total, status: "SENT" } });
  await addEvent(c.id, "INVOICE", `Invoice ${inv.number} raised for AED ${a.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}.`, owner.name);
  refresh(c.id);
  return { error: null, ok: true };
}

/** Records money received. Against an invoice it can be the whole of what is left or part; an invoice paid in full is marked paid. */
export async function recordPaymentAction(_prev: OwnerState, fd: FormData): Promise<OwnerState> {
  const owner = await requireOwner();
  const customerId = text(fd, "id");
  const invoiceId = text(fd, "invoiceId") || null;
  const amount = money(fd, "amount");
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the amount received." };
  const invoice = invoiceId ? await prisma.customerInvoice.findFirst({ where: { id: invoiceId, customerId }, include: { payments: { select: { amount: true } } } }) : null;
  if (invoiceId && !invoice) return { error: "That invoice wasn't found." };
  const paidBefore = invoice ? invoice.payments.reduce((s, p) => s + Number(p.amount), 0) : 0;
  if (invoice && invoice.status !== "SENT") return { error: "Only an invoice that has been sent can be paid." };
  if (invoice && amount > outstanding(Number(invoice.total), paidBefore) + 0.005) return { error: "That is more than what is left on the invoice." };
  const receivedOn = dateOrNull(fd, "receivedOn") ?? new Date();
  await prisma.$transaction(async (tx) => {
    await tx.customerPayment.create({ data: { customerId, invoiceId, amount, receivedOn, method: text(fd, "method") || "BANK", reference: text(fd, "reference") || null, note: text(fd, "note") || null } });
    if (invoice && outstanding(Number(invoice.total), paidBefore + amount) === 0) await tx.customerInvoice.update({ where: { id: invoice.id }, data: { status: "PAID", paidOn: receivedOn } });
  });
  await addEvent(customerId, "PAYMENT", `AED ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} received${invoice ? ` against ${invoice.number}` : ""}.`, owner.name);
  refresh(customerId);
  return { error: null, ok: true };
}

export async function voidInvoiceAction(_prev: OwnerState, fd: FormData): Promise<OwnerState> {
  const owner = await requireOwner();
  const inv = await prisma.customerInvoice.findUnique({ where: { id: text(fd, "invoiceId") }, include: { _count: { select: { payments: true } } } });
  if (!inv) return { error: "Invoice not found." };
  if (inv._count.payments > 0) return { error: "This invoice has payments against it, so it can't be voided." };
  await prisma.customerInvoice.update({ where: { id: inv.id }, data: { status: "VOID" } });
  await addEvent(inv.customerId, "INVOICE", `Invoice ${inv.number} voided.`, owner.name);
  refresh(inv.customerId);
  return { error: null, ok: true };
}

export async function addNoteAction(_prev: OwnerState, fd: FormData): Promise<OwnerState> {
  const owner = await requireOwner();
  const id = text(fd, "id");
  const note = text(fd, "note");
  if (!note) return { error: "Write the note first." };
  if (!(await prisma.customer.findUnique({ where: { id }, select: { id: true } }))) return { error: "Customer not found." };
  await addEvent(id, "NOTE", note, owner.name);
  refresh(id);
  return { error: null, ok: true };
}

/** Refreshes every customer's usage in one go. */
export async function syncAllAction(): Promise<OwnerState> {
  await requireOwner();
  const all = await prisma.customer.findMany({ where: { status: { not: "CHURNED" } } });
  let failed = 0;
  await Promise.all(all.map(async (c) => { const r = await syncCustomer(c).catch(() => ({ error: "x" })); if ("error" in r) failed++; }));
  refresh();
  return failed ? { error: `${failed} customer${failed === 1 ? "" : "s"} couldn't be reached.` } : { error: null, ok: true };
}
