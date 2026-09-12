"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/Switch";
import { Slider } from "@/components/ui/Slider";
import { NumberInput } from "@/components/ui/NumberInput";
import { DatePicker } from "@/components/ui/DatePicker";
import { Checkbox } from "@/components/ui/Checkbox";
import { skillLevelLabel } from "@/lib/skillLevel";

/** Design-system reference for the shared UI primitives. Behind auth, like every other (app) route. */
export default function BrandPage() {
  const [own, setOwn] = useState(true);
  const [manual, setManual] = useState(false);
  const [ot, setOt] = useState(true);
  const [level, setLevel] = useState(70);
  const [level2, setLevel2] = useState(30);
  const [qty, setQty] = useState<number | "">(3);
  const [rate, setRate] = useState<number | "">(12.5);
  const [visa, setVisa] = useState("2031-04-15");
  const [submitted, setSubmitted] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-lg font-semibold text-primary">UI primitives</h1>
        <p className="mt-1 text-sm text-muted">
          Switch, Slider, NumberInput and DatePicker — before vs after.
        </p>
      </div>

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
              <input type="number" defaultValue={3} min={0} className="input w-full" />
            </label>
            <label className="w-32">
              <span className="mb-1 block text-xs font-medium text-muted">Rate (AED)</span>
              <input type="number" step="0.01" defaultValue={12.5} className="input w-full" />
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
            <input type="date" defaultValue="2031-04-15" className="input w-full" />
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
