import Link from "next/link";
import { Plus, Clock3, FileText, PhoneCall, AlertTriangle, Send } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatTile } from "@/components/StatTile";
import { KanbanBoard } from "@/components/KanbanBoard";
import { EmptyState } from "@/components/EmptyState";
import { AttentionPanel, type AttentionItem } from "@/components/dashboard/AttentionList";
import { prisma } from "@/lib/db";
import { branchWhere } from "@/lib/branch";
import { isAdminRole } from "@/lib/roles";
import { requireUserWithBranch } from "@/lib/auth";
import { parseAdjustments, parseQuoteSettings, quoteTotals } from "@/lib/quotationMath";
import { QuoteSettingsDialog } from "./quote-settings";

const OPEN = ["DRAFT", "SENT", "NEGOTIATION", "APPROVED"];
const DAY = 86_400_000;
const money = (v: number) => `AED ${Math.round(v).toLocaleString()}`;

function columnOf(status: string): string {
  if (status === "DRAFT") return "draft";
  if (status === "SENT") return "sent";
  if (status === "NEGOTIATION" || status === "APPROVED") return "negotiating";
  if (status === "ACCEPTED" || status === "CONVERTED") return "won";
  return "lost";
}

export default async function SalesPipelinePage() {
  const { user, branchId } = await requireUserWithBranch();
  const scope = branchWhere(branchId);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + DAY - 1);
  const since = new Date(now.getTime() - 90 * DAY);

  const [quotations, enquiries, branch] = await Promise.all([
    prisma.quotation.findMany({
      where: { ...scope, OR: [{ status: { in: [...OPEN, "ACCEPTED", "CONVERTED"] } }, { createdAt: { gte: since } }] },
      include: { client: { select: { name: true } }, lines: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.enquiry.findMany({
      where: { ...scope, OR: [{ status: { in: ["Open", "Quoted"] } }, { createdAt: { gte: since } }] },
      include: { client: { select: { name: true } }, quotations: { select: { id: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    }),
    branchId ? prisma.branch.findUnique({ where: { id: branchId }, select: { quoteSettings: true } }) : null,
  ]);
  const settings = parseQuoteSettings(branch?.quoteSettings);
  const totalOf = (q: (typeof quotations)[number]) => quoteTotals(q.lines, parseAdjustments(q.adjustments), settings).total;

  const open = quotations.filter((q) => OPEN.includes(q.status));
  const openValue = open.reduce((n, q) => n + totalOf(q), 0);
  const openWorkers = open.reduce((n, q) => n + q.lines.reduce((m, l) => m + l.quantity, 0), 0);
  const recent = quotations.filter((q) => q.createdAt >= since);
  const won = recent.filter((q) => q.status === "ACCEPTED" || q.status === "CONVERTED").length;
  const lost = recent.filter((q) => q.status === "REJECTED").length;
  const winRate = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : null;
  const replies = enquiries
    .filter((e) => e.createdAt >= since && e.quotations.length > 0)
    .map((e) => (Math.min(...e.quotations.map((q) => q.createdAt.getTime())) - e.createdAt.getTime()) / DAY);
  const avgReply = replies.length > 0 ? replies.reduce((a, b) => a + b, 0) / replies.length : null;

  // What needs a nudge, most urgent first.
  const rows: (AttentionItem & { rank: number })[] = [];
  const dueIn = (d: Date) => Math.round((d.getTime() - startOfToday.getTime()) / DAY);
  for (const q of open) {
    if (q.nextFollowUpAt && q.nextFollowUpAt <= endOfToday) {
      const late = -dueIn(q.nextFollowUpAt);
      rows.push({ rank: late > 0 ? 1 : 3, key: `fq-${q.id}`, tone: late > 0 ? "red" : "amber", icon: PhoneCall, title: `Follow up ${q.client.name}`, sub: `${q.quotationNumber} · ${q.status.toLowerCase()}${q.sentAt ? ` since ${q.sentAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}`, href: `/sales/quotations/${q.id}`, action: "Open", tag: late > 0 ? `Overdue ${late} d` : "Today" });
    } else if (q.validUntil && ["SENT", "NEGOTIATION", "APPROVED"].includes(q.status) && dueIn(q.validUntil) <= 3) {
      const d = dueIn(q.validUntil);
      rows.push({ rank: d < 0 ? 2 : 4, key: `xq-${q.id}`, tone: d < 0 ? "red" : "amber", icon: Clock3, title: d < 0 ? `${q.quotationNumber} has expired` : `${q.quotationNumber} lapses ${d === 0 ? "today" : `in ${d} d`}`, sub: `${q.client.name} · valid until ${q.validUntil.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, href: `/sales/quotations/${q.id}`, action: "Extend or revise", tag: d < 0 ? "Expired" : undefined });
    } else if (q.status === "SENT" && q.sentAt && !q.nextFollowUpAt && now.getTime() - q.sentAt.getTime() > 5 * DAY) {
      rows.push({ rank: 6, key: `nr-${q.id}`, tone: "blue", icon: Send, title: `No reply from ${q.client.name}`, sub: `${q.quotationNumber} sent ${Math.floor((now.getTime() - q.sentAt.getTime()) / DAY)} days ago, no follow-up set`, href: `/sales/quotations/${q.id}`, action: "Follow up" });
    }
  }
  for (const e of enquiries.filter((x) => x.status === "Open" || x.status === "Quoted")) {
    if (e.nextFollowUpAt && e.nextFollowUpAt <= endOfToday) {
      const late = -dueIn(e.nextFollowUpAt);
      rows.push({ rank: late > 0 ? 1 : 3, key: `fe-${e.id}`, tone: late > 0 ? "red" : "amber", icon: PhoneCall, title: `Follow up ${e.client.name}`, sub: `ENQ-${e.enquiryNo}${e.requiredTrade ? ` · ${e.requiredTrade}` : ""}`, href: `/sales/enquiries/${e.id}`, action: "Open", tag: late > 0 ? `Overdue ${late} d` : "Today" });
    } else if (e.status === "Open" && e.quotations.length === 0 && now.getTime() - e.createdAt.getTime() > 5 * DAY) {
      rows.push({ rank: 5, key: `we-${e.id}`, tone: "amber", icon: FileText, title: `ENQ-${e.enquiryNo} is waiting for a quotation`, sub: `${e.client.name} · ${Math.floor((now.getTime() - e.createdAt.getTime()) / DAY)} days old`, href: `/sales/quotations/new?enquiryId=${e.id}&clientId=${e.clientId}`, action: "Quote" });
    }
  }
  rows.sort((a, b) => a.rank - b.rank);
  const dueToday = rows.filter((r) => r.rank <= 3).length;

  const ageLabel = (d: Date) => {
    const n = Math.floor((now.getTime() - d.getTime()) / DAY);
    return n === 0 ? "Today" : `${n} d`;
  };
  const chip = (text: string, tone: "red" | "amber" | "muted") => (
    <span className={`text-[11px] font-medium ${tone === "red" ? "text-[var(--error)]" : tone === "amber" ? "text-[var(--warning)]" : "text-subtle"}`}>{text}</span>
  );

  const cards = [
    ...enquiries
      .filter((e) => e.status === "Open" || (e.status === "Lost" && e.createdAt >= since))
      .map((e) => ({
        id: `e:${e.id}`,
        columnId: e.status === "Lost" ? "lost" : "enquiry",
        content: (
          <Link href={`/sales/enquiries/${e.id}`} className="block space-y-1" draggable={false}>
            <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-primary">ENQ-{e.enquiryNo}</span>{chip(ageLabel(e.createdAt), e.status === "Open" && now.getTime() - e.createdAt.getTime() > 7 * DAY ? "amber" : "muted")}</div>
            <p className="truncate text-sm text-secondary">{e.client.name}</p>
            <p className="truncate text-xs text-muted">{[e.requiredTrade, e.projectHint].filter(Boolean).join(" · ") || "—"}</p>
            {e.status === "Lost" && e.lostReason && <p className="truncate text-xs text-[var(--error)]">{e.lostReason}</p>}
            {e.nextFollowUpAt && e.status === "Open" && chip(`Follow-up ${e.nextFollowUpAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`, e.nextFollowUpAt <= endOfToday ? "red" : "muted")}
          </Link>
        ),
      })),
    ...quotations
      .filter((q) => OPEN.includes(q.status) || q.status === "ACCEPTED" || q.status === "CONVERTED" || (q.status === "REJECTED" && q.createdAt >= since))
      .map((q) => {
        const workers = q.lines.reduce((n, l) => n + l.quantity, 0);
        const left = q.validUntil ? dueIn(q.validUntil) : null;
        return {
          id: `q:${q.id}`,
          columnId: columnOf(q.status),
          weight: OPEN.includes(q.status) ? workers : undefined,
          content: (
            <Link href={`/sales/quotations/${q.id}`} className="block space-y-1" draggable={false}>
              <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-primary">{q.quotationNumber}{q.version > 1 && <span className="ml-1.5 rounded bg-surface-sunken px-1 text-[10px] font-semibold text-muted">v{q.version}</span>}</span><span className="tabular text-xs text-muted">{money(totalOf(q))}/mo</span></div>
              <p className="truncate text-sm text-secondary">{q.client.name}</p>
              <p className="truncate text-xs text-muted">{q.lines.map((l) => `${l.quantity} ${l.trade}`).join(" · ")}</p>
              {q.status === "REJECTED" && q.lostReason && <p className="truncate text-xs text-[var(--error)]">{q.lostReason}</p>}
              {OPEN.includes(q.status) && (q.nextFollowUpAt && q.nextFollowUpAt <= endOfToday ? chip("Follow up today", "red") : left !== null && left <= 3 ? chip(left < 0 ? `Expired ${-left} d ago` : `Expires in ${left} d`, left < 0 ? "red" : "amber") : left !== null ? chip(`${left} d left`, "muted") : null)}
            </Link>
          ),
        };
      }),
  ];

  const empty = enquiries.length === 0 && quotations.length === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales pipeline"
        description="Enquiries and quotations in one place, from first call to signed."
        actions={
          <>
            {isAdminRole(user.role) && <QuoteSettingsDialog settings={settings} />}
            <Link href="/sales/enquiries/new" className="btn btn-secondary btn-sm"><Plus className="h-3.5 w-3.5" aria-hidden />Enquiry</Link>
            <Link href="/sales/quotations/new" className="btn btn-primary btn-sm"><Plus className="h-3.5 w-3.5" aria-hidden />Quotation</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile label="Open pipeline" value={money(openValue)} hint={`${open.length} quotation${open.length === 1 ? "" : "s"} · ${openWorkers} workers a month`} />
        <StatTile label="Follow-ups due" value={dueToday} hint="today or overdue" tone={dueToday > 0 ? "warning" : "default"} />
        <StatTile label="Win rate · 90 days" value={winRate === null ? "—" : `${winRate}%`} hint={`${won} won · ${lost} lost`} />
        <StatTile label="Reply time" value={avgReply === null ? "—" : `${avgReply.toFixed(1)} d`} hint="enquiry → quotation" />
      </div>

      <AttentionPanel title="Follow up" items={rows} max={4} />

      {empty ? (
        <EmptyState
          icon={AlertTriangle}
          title="Nothing in the pipeline yet"
          description="Log an enquiry when a client asks for workers, then raise a quotation against it. They will appear here, stage by stage."
          action={<Link href="/sales/enquiries/new" className="btn btn-primary btn-sm">New enquiry</Link>}
        />
      ) : (
        <KanbanBoard
          weightLabel="workers"
          columns={[
            { id: "enquiry", title: "New enquiry", tone: "amber" },
            { id: "draft", title: "Draft", tone: "slate" },
            { id: "sent", title: "Sent", tone: "blue" },
            { id: "negotiating", title: "Negotiating", tone: "amber" },
            { id: "won", title: "Won", tone: "green" },
            { id: "lost", title: "Lost", tone: "red", hint: "Last 90 days" },
          ]}
          cards={cards}
          emptyText="Nothing here"
        />
      )}
      <p className="text-xs text-subtle">Open a card to change its stage, add notes or send it. <Link href="/sales/enquiries" className="underline">All enquiries</Link> · <Link href="/sales/quotations" className="underline">All quotations</Link></p>
    </div>
  );
}
