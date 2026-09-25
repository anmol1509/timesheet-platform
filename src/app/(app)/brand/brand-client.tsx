"use client";

import { useState } from "react";
import { FileQuestion } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { Slider } from "@/components/ui/Slider";
import { NumberInput } from "@/components/ui/NumberInput";
import { DatePicker } from "@/components/ui/DatePicker";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";
import { FileDrop } from "@/components/ui/FileDrop";
import { EmptyState } from "@/components/EmptyState";
import { ThemeToggle } from "@/components/ThemeToggle";
import { FadeIn, Stagger, StaggerItem, AnimatedNumber, SlideOver } from "@/components/motion";
import { useReducedMotion } from "motion/react";
import { AnimatedTabs } from "@/components/motion/AnimatedTabs";
import { Stepper, type StepItem } from "@/components/motion/Stepper";
import { skillLevelLabel } from "@/lib/skillLevel";
import type { ThemePreference } from "@/lib/theme-preference";

const TOKEN_SWATCHES = [
  { name: "canvas", var: "--canvas" },
  { name: "surface", var: "--surface" },
  { name: "surface-subtle", var: "--surface-subtle" },
  { name: "surface-hover", var: "--surface-hover" },
  { name: "surface-sunken", var: "--surface-sunken" },
  { name: "border", var: "--border" },
  { name: "border-strong", var: "--border-strong" },
  { name: "brand-primary", var: "--brand-primary" },
  { name: "success", var: "--success" },
  { name: "warning", var: "--warning" },
  { name: "error", var: "--error" },
  { name: "info", var: "--info" },
] as const;

const TYPE_SCALE = [
  { cls: "text-2xl", label: "text-2xl — hero numbers (30px)" },
  { cls: "text-xl", label: "text-xl — KPI figures (24px)" },
  { cls: "text-lg", label: "text-lg — page titles (20px)" },
  { cls: "text-md", label: "text-md — card titles (16px)" },
  { cls: "text-base", label: "text-base — default UI (14px)" },
  { cls: "text-sm", label: "text-sm — body/table cells (13px)" },
  { cls: "text-xs", label: "text-xs — meta, timestamps (12px)" },
] as const;

const DEMO_STEPS: StepItem[] = [
  { key: "documents", label: "Documents", status: "done" },
  { key: "company", label: "Company", status: "done" },
  { key: "identity", label: "Identity", status: "current" },
  { key: "expiry", label: "Numbers & expiry", status: "upcoming" },
  { key: "review", label: "Review", status: "upcoming" },
];

/** Design-system reference for tokens, motion and the shared UI primitives. Behind auth, like every other (app) route. */
export function BrandClient({ initialTheme }: { initialTheme: ThemePreference }) {
  const [own, setOwn] = useState(true);
  const [manual, setManual] = useState(false);
  const [ot, setOt] = useState(true);
  const [level, setLevel] = useState(70);
  const [level2, setLevel2] = useState(30);
  const [qty, setQty] = useState<number | "">(3);
  const [rate, setRate] = useState<number | "">(12.5);
  const [visa, setVisa] = useState("2031-04-15");
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [kpi, setKpi] = useState(67);
  const [tab, setTab] = useState("overview");
  const [sheetOpen, setSheetOpen] = useState(false);
  // motion's own hook (subscribes via useSyncExternalStore internally, so it
  // has no hydration-mismatch/effect-ordering issue to work around here).
  const reducedMotion = useReducedMotion();

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-page-title">Design system</h1>
          <p className="mt-1 text-sm text-muted">
            Phase 1 foundations: tokens, dark mode, the motion kit, and the shared primitives —
            before vs after.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {reducedMotion && (
            <span className="rounded-md bg-[var(--warning-soft)] px-2 py-1 text-xs font-medium text-[var(--warning)]">
              prefers-reduced-motion: on
            </span>
          )}
          <ThemeToggle initial={initialTheme} />
        </div>
      </div>

      <Card title="Colour tokens">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {TOKEN_SWATCHES.map((t) => (
            <div key={t.var} className="space-y-1.5">
              <div
                className="h-12 rounded-control border border-default"
                style={{ background: `var(${t.var})` }}
              />
              <p className="font-mono text-[11px] text-muted">{t.name}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-subtle">
          Same tokens, different values per theme — switch the toggle above. Radii stay
          controls 8px / cards 10px / overlays 14px in both.
        </p>
      </Card>

      <Card title="Type scale">
        <div className="space-y-2">
          {TYPE_SCALE.map((t) => (
            <p key={t.cls} className={`${t.cls} text-primary`}>
              {t.label}
            </p>
          ))}
        </div>
      </Card>

      <Card title="Motion kit">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-muted">AnimatedNumber (tabular, count-up)</p>
            <p className="text-kpi text-primary">
              <AnimatedNumber value={kpi} suffix="%" />
            </p>
            <button
              type="button"
              className="btn btn-secondary btn-sm mt-2"
              onClick={() => setKpi((k) => (k === 67 ? 92 : 67))}
            >
              Change value
            </button>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">AnimatedTabs (shared underline)</p>
            <AnimatedTabs
              layoutId="brand-demo-tabs"
              value={tab}
              onValueChange={setTab}
              tabs={[
                { value: "overview", label: "Overview" },
                { value: "documents", label: "Documents" },
                { value: "history", label: "History" },
              ]}
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">Stepper</p>
            <Stepper steps={DEMO_STEPS} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-muted">SlideOver</p>
            <Button size="sm" variant="secondary" onClick={() => setSheetOpen(true)}>
              Open panel
            </Button>
            <SlideOver
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              title="Ajay Kumar — 12 Sept"
              description="Mark attendance for the day without leaving the calendar."
            >
              <p className="text-sm text-muted">
                Demo panel for the SlideOver primitive — the Daily Attendance redesign (Phase 5)
                uses this shape for the day editor.
              </p>
            </SlideOver>
          </div>
        </div>
        <div className="mt-6 border-t border-default pt-5">
          <p className="mb-3 text-xs font-medium text-muted">Stagger (dashboard panels, short lists)</p>
          <Stagger className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {["Workforce", "Deployed", "Projects", "Needs attention"].map((label) => (
              <StaggerItem key={label}>
                <FadeIn className="card card-padded">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="text-kpi text-primary">—</p>
                </FadeIn>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </Card>

      <Card title="FileDrop, Tooltip, EmptyState">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <FileDrop onFiles={() => {}} label="Drop the document pack" hint="PDF, JPG or PNG" />
          <EmptyState
            size="compact"
            icon={FileQuestion}
            title="No sites yet"
            description="Add a site above and it will appear under its project."
          />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Tooltip label="This is a Radix tooltip — portalled, flips near edges">
            <button type="button" className="btn btn-secondary btn-sm">
              Hover me
            </button>
          </Tooltip>
        </div>
      </Card>

      <Row>
        <Card title="Before — supplier settings">
          <div className="space-y-3">
            <Checkbox label="Our own company" defaultChecked />
            <Checkbox label="Allow manual labour ID" />
            <Checkbox label="Overtime applies" defaultChecked />
          </div>
        </Card>
        <Card title="After — supplier settings">
          <div className="space-y-3.5">
            <Switch
              checked={own}
              onCheckedChange={setOwn}
              label="Our own company"
              description="Issues documents on our letterhead, and bills this entity rather than paying it."
            />
            <Switch checked={manual} onCheckedChange={setManual} label="Allow manual labour ID" />
            <Switch checked={ot} onCheckedChange={setOt} label="Overtime applies" />
          </div>
        </Card>
      </Row>

      <Row>
        <Card title="Before — skill level">
          <div className="w-60">
            <span className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
              <span>Level</span>
              <span className="text-secondary">{skillLevelLabel(level2)} · {level2}%</span>
            </span>
            <input
              type="range"
              min={10}
              max={100}
              step={10}
              value={level2}
              onChange={(e) => setLevel2(Number(e.target.value))}
              aria-label="Trade level (native)"
              className="mt-2.5 w-full accent-[var(--brand-primary)]"
            />
          </div>
        </Card>
        <Card title="After — skill level">
          <Slider
            className="w-60"
            label="Level"
            valueLabel={`${skillLevelLabel(level)} · ${level}%`}
            min={10}
            max={100}
            step={10}
            value={level}
            onChange={setLevel}
            ariaLabel="Trade level"
          />
        </Card>
      </Row>

      <Row>
        <Card title="Before — quantity & rate">
          <div className="flex gap-3">
            <label className="w-24">
              <span className="mb-1 block text-xs font-medium text-muted">Qty</span>
              <NumberInput defaultValue={3} min={0} className="w-full" />
            </label>
            <label className="w-32">
              <span className="mb-1 block text-xs font-medium text-muted">Rate (AED)</span>
              <NumberInput defaultValue={12.5} step={0.01} className="w-full" />
            </label>
          </div>
        </Card>
        <Card title="After — quantity & rate">
          <div className="flex gap-3">
            <div className="w-32">
              <span className="mb-1 block text-xs font-medium text-muted">Qty</span>
              <NumberInput value={qty} onChange={setQty} min={0} max={99} step={1} ariaLabel="Quantity" />
            </div>
            <div className="w-40">
              <span className="mb-1 block text-xs font-medium text-muted">Rate (AED)</span>
              <NumberInput value={rate} onChange={setRate} min={0} step={0.01} ariaLabel="Rate" />
            </div>
          </div>
        </Card>
      </Row>

      <Row>
        <Card title="Before — visa expiry">
          <label className="block w-48">
            <span className="mb-1 block text-xs font-medium text-muted">Visa expiry</span>
            <DatePicker defaultValue="2031-04-15" className="w-full" />
          </label>
        </Card>
        <Card title="After — visa expiry">
          <div className="w-48">
            <span className="mb-1 block text-xs font-medium text-muted">Visa expiry</span>
            <DatePicker value={visa} onChange={setVisa} ariaLabel="Visa expiry" />
            <p className="mt-1.5 text-[11px] text-subtle">
              Submits <code className="tabular">{visa || "(empty)"}</code>
            </p>
          </div>
        </Card>
      </Row>

      <Card title="Form submission (what the server would receive)">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setSubmitted(JSON.stringify(Object.fromEntries(fd.entries()), null, 1));
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <div className="w-48">
            <span className="mb-1 block text-xs font-medium text-muted">activeFrom</span>
            <DatePicker name="activeFrom" defaultValue="2026-01-31" ariaLabel="Active from" />
          </div>
          <div className="w-44">
            <span className="mb-1 block text-xs font-medium text-muted">supplierAmountLimit</span>
            <NumberInput name="supplierAmountLimit" defaultValue={2500} min={0} step={0.01} ariaLabel="Limit" />
          </div>
          <button type="submit" className="btn btn-primary">Submit</button>
        </form>
        {submitted && (
          <pre className="mt-3 overflow-x-auto rounded-control bg-surface-sunken p-3 text-xs text-secondary">
            {submitted}
          </pre>
        )}
      </Card>

      <Card title="States">
        <div className="flex flex-wrap items-center gap-8">
          <Switch defaultChecked={false} label="Off" />
          <Switch defaultChecked label="On" />
          <Switch defaultChecked={false} label="Disabled off" disabled />
          <Switch defaultChecked label="Disabled on" disabled />
        </div>
        <div className="mt-6 grid max-w-md grid-cols-1 gap-5">
          <Slider label="Empty" valueLabel="10%" min={10} max={100} step={10} defaultValue={10} />
          <Slider label="Full" valueLabel="100%" min={10} max={100} step={10} defaultValue={100} />
          <Slider label="Disabled" valueLabel="50%" min={10} max={100} step={10} defaultValue={50} disabled />
        </div>
        <div className="mt-6 flex flex-wrap items-end gap-3">
          <div className="w-32">
            <span className="mb-1 block text-xs font-medium text-muted">At min (0)</span>
            <NumberInput defaultValue={0} min={0} max={10} ariaLabel="At min" />
          </div>
          <div className="w-32">
            <span className="mb-1 block text-xs font-medium text-muted">Disabled</span>
            <NumberInput defaultValue={5} disabled ariaLabel="Disabled number" />
          </div>
          <div className="w-48">
            <span className="mb-1 block text-xs font-medium text-muted">Empty date</span>
            <DatePicker ariaLabel="Empty date" />
          </div>
        </div>
      </Card>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div>;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card card-padded">
      <h2 className="mb-4 text-sm font-semibold text-primary">{title}</h2>
      {children}
    </section>
  );
}
