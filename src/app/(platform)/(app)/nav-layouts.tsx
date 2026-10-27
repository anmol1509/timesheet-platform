"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Briefcase, ChevronDown, Gauge, LayoutDashboard, LayoutGrid, Receipt, Settings, Users, Wrench, type LucideIcon } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { ACTIVE, INACTIVE, ROW, allEntries, groupContainsActive, resolveActiveHref, visibleEntries, type Entry, type Item } from "./nav-links";

/* The alternative menu layouts. They all read the same NAV as the classic sidebar, so a page added there shows up
 * everywhere, and permissions are applied by the same visibleEntries filter. */

type Props = {
  isAdmin: boolean;
  isOwner?: boolean;
  allowedModules: string[] | null;
  pendingApprovals?: number;
  badges?: Record<string, number>;
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Owner: Gauge,
  Home: LayoutDashboard,
  People: Users,
  Operations: Wrench,
  "Time & Billing": Receipt,
  Commercial: Briefcase,
  Setup: Settings,
};

function useNavModel({ isAdmin, isOwner = false, allowedModules, pendingApprovals = 0, badges = {} }: Props) {
  const pathname = usePathname();
  const entries = useMemo(() => visibleEntries(allEntries(isAdmin, isOwner), allowedModules, isAdmin), [isAdmin, isOwner, allowedModules]);
  const activeHref = resolveActiveHref(pathname, entries);
  const activeEntry = entries.find((e) => (e.type === "link" ? e.item.href === activeHref : groupContainsActive(activeHref, e.children))) ?? null;
  const categories = useMemo(() => [...new Set(entries.map((e) => e.category))], [entries]);
  const countFor = (href: string) => (href === "/approvals" ? pendingApprovals : badges[href] ?? 0);
  const entryCount = (e: Entry) => (e.type === "link" ? countFor(e.item.href) : e.children.reduce((n, c) => n + countFor(c.href), 0));
  const categoryCount = (c: string) => entries.filter((e) => e.category === c).reduce((n, e) => n + entryCount(e), 0);
  return { entries, activeHref, activeEntry, categories, countFor, entryCount, categoryCount };
}

const iconOf = (category: string) => CATEGORY_ICONS[category] ?? LayoutGrid;

function Count({ n, urgent }: { n: number; urgent?: boolean }) {
  if (n <= 0) return null;
  return (
    <span className={cn("tabular ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold text-white", urgent ? "bg-[var(--error)]" : "bg-[var(--warning)]")} aria-label={`${n} need attention`}>
      {n > 99 ? "99+" : n}
    </span>
  );
}

function PageRow({ item, active, count, onNavigate }: { item: Item; active: boolean; count: number; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn(ROW, "gap-2.5 px-2.5 py-1.5", active ? ACTIVE : INACTIVE)}>
      <Icon className={cn("h-4 w-4 shrink-0", !active && "text-muted")} />
      <span className="truncate">{item.label}</span>
      <Count n={count} urgent={item.href === "/approvals"} />
    </Link>
  );
}

/** Every page of one category: single pages as rows, groups as a small heading with their pages under it. */
function CategoryPages({ model, category, onNavigate }: { model: ReturnType<typeof useNavModel>; category: string; onNavigate?: () => void }) {
  const list = model.entries.filter((e) => e.category === category);
  return (
    <div className="flex flex-col gap-px">
      {list.map((e) =>
        e.type === "link" ? (
          <PageRow key={e.item.href} item={e.item} active={e.item.href === model.activeHref} count={model.countFor(e.item.href)} onNavigate={onNavigate} />
        ) : (
          <div key={e.label} className="flex flex-col gap-px">
            <p className="px-2.5 pt-2.5 pb-1 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase">{e.label}</p>
            {e.children.map((c) => <PageRow key={c.href} item={c} active={c.href === model.activeHref} count={model.countFor(c.href)} onNavigate={onNavigate} />)}
          </div>
        )
      )}
    </div>
  );
}

/** Layout 4: no sidebar. One menu across the top, a drop-down per area. */
export function TopNav(props: Props & { brandSlot?: React.ReactNode }) {
  const model = useNavModel(props);
  const [openCat, setOpenCat] = useState<string | null>(null);
  return (
    <nav aria-label="Main" className="glass nav-surface mx-3 mt-3 hidden items-center gap-1 rounded-[22px] px-3 py-2 lg:flex">
      <div className="mr-2 shrink-0 pr-2"><BrandMark collapsed /></div>
      {model.categories.map((c) => {
        const Icon = iconOf(c);
        const here = model.activeEntry?.category === c;
        const single = model.entries.filter((e) => e.category === c);
        const count = model.categoryCount(c);
        // An area with one page needs no drop-down.
        if (single.length === 1 && single[0].type === "link") {
          const item = single[0].item;
          return (
            <Link key={c} href={item.href} aria-current={here ? "page" : undefined} className={cn(ROW, "gap-2 px-3 py-2", here ? ACTIVE : INACTIVE)}>
              <Icon className="h-4 w-4" />{item.label}
            </Link>
          );
        }
        return (
          <Popover.Root key={c} open={openCat === c} onOpenChange={(o) => setOpenCat(o ? c : null)}>
            <Popover.Trigger asChild>
              <button type="button" className={cn(ROW, "gap-2 px-3 py-2", here ? ACTIVE : INACTIVE)}>
                <Icon className="h-4 w-4" />{c}
                {count > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[var(--error)]" aria-hidden />}
                <ChevronDown className="h-3.5 w-3.5 text-subtle" aria-hidden />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="start" sideOffset={8} className="rx-popover z-50 max-h-[70vh] w-64 overflow-y-auto rounded-card border border-default bg-surface p-1.5 shadow-popover">
                <CategoryPages model={model} category={c} onNavigate={() => setOpenCat(null)} />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        );
      })}
      {props.brandSlot && <div className="ml-auto min-w-0">{props.brandSlot}</div>}
    </nav>
  );
}

/** Layout 5: an icon rail of areas and a column with that area's pages. */
export function TwoLevelNav({ brandSlot, ...props }: Props & { brandSlot?: React.ReactNode }) {
  const model = useNavModel(props);
  const [picked, setPicked] = useState<string | null>(null);
  const current = picked ?? model.activeEntry?.category ?? model.categories[0];
  return (
    <>
      <aside className="glass nav-surface fixed top-3 bottom-3 left-3 z-20 hidden w-20 flex-col items-center gap-1 rounded-[22px] py-3 lg:flex">
        <div className="mb-2"><BrandMark collapsed /></div>
        {model.categories.map((c) => {
          const Icon = iconOf(c);
          const on = c === current;
          const count = model.categoryCount(c);
          return (
            <Tooltip key={c} label={c}>
              <button type="button" onClick={() => setPicked(c)} aria-label={c} aria-pressed={on} className={cn(ROW, "relative w-[4.25rem] flex-col gap-0.5 px-0.5 py-1.5", on ? ACTIVE : INACTIVE)}>
                <Icon className="h-[18px] w-[18px]" />
                <span className="w-full text-center text-[10px] leading-[1.15]">{c}</span>
                {count > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--error)]" aria-hidden />}
              </button>
            </Tooltip>
          );
        })}
      </aside>
      <aside className="glass nav-surface fixed top-3 bottom-3 left-[6.25rem] z-20 hidden w-56 flex-col overflow-hidden rounded-[22px] lg:flex">
        <h2 className="shrink-0 px-4 pt-4 pb-2 text-sm font-semibold text-primary">{current}</h2>
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3">
          <CategoryPages model={model} category={current} />
        </div>
        {brandSlot && <div className="shrink-0 border-t border-default p-3">{brandSlot}</div>}
      </aside>
    </>
  );
}

/** Layout 6, left side: a plain list of modules. Each opens its first page; the rest are tabs in the page area. */
export function ModuleList({ brandSlot, ...props }: Props & { brandSlot?: React.ReactNode }) {
  const model = useNavModel(props);
  return (
    <aside className="glass nav-surface nav-hide fixed top-3 bottom-3 left-3 z-40 hidden w-56 flex-col overflow-hidden rounded-[22px] lg:flex">
      <div className="flex h-16 shrink-0 items-center px-4"><BrandMark /></div>
      {brandSlot && <div className="shrink-0 px-3 pb-1">{brandSlot}</div>}
      <nav aria-label="Modules" className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <div className="flex flex-col gap-px">
          {model.entries.map((e) => {
            const Icon = e.type === "link" ? e.item.icon : e.icon;
            const label = e.type === "link" ? e.item.label : e.label;
            const href = e.type === "link" ? e.item.href : e.children[0].href;
            const on = model.activeEntry === e;
            return (
              <Link key={href} href={href} aria-current={on ? "page" : undefined} className={cn(ROW, "gap-3 px-2.5 py-1.5", on ? ACTIVE : INACTIVE)}>
                <Icon className={cn("h-[18px] w-[18px] shrink-0", !on && "text-muted")} />
                <span className="truncate">{label}</span>
                <Count n={model.entryCount(e)} urgent={e.type === "link" && e.item.href === "/approvals"} />
              </Link>
            );
          })}
        </div>
      </nav>
    </aside>
  );
}

/** Layout 6, page area: the pages of the current module as tabs. */
export function ModuleTabs(props: Props) {
  const model = useNavModel(props);
  const e = model.activeEntry;
  if (!e || e.type !== "group" || e.children.length < 2) return null;
  return (
    <nav aria-label="Pages in this module" className="-mx-4 mb-5 hidden overflow-x-auto border-b border-default px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:flex lg:px-8">
      <div className="flex gap-1">
        {e.children.map((c) => {
          const on = c.href === model.activeHref;
          return (
            <Link key={c.href} href={c.href} aria-current={on ? "page" : undefined}
              className={cn("relative -mb-px inline-flex min-h-10 items-center gap-2 border-b-2 px-3 text-[13px] font-medium whitespace-nowrap transition",
                on ? "border-[var(--brand-primary)] text-[var(--brand-primary)]" : "border-transparent text-muted hover:border-[var(--border-strong)] hover:text-primary")}>
              {c.label}
              <Count n={model.countFor(c.href)} urgent={c.href === "/approvals"} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
