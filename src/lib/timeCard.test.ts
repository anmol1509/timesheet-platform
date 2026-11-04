import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_SPEC, GEOM, buildCardDays, dayOfRow, readTimeCardSpec, type RawDay } from "./timeCard";
import { rawDaysFromSheets } from "./timeCardData";

const present = (date: string, normalHours: number | null = 8): RawDay => ({ date, status: "PRESENT", normalHours, otHours: null });
const base = { month: "2026-10", dailyHours: 8, weeklyOffDays: [5], inOut: "blank" as const, shiftIn: "07:00", shiftOut: "16:00" };

test("a day over the standard day shows its overtime, and a weekly off day worked is all overtime", () => {
  const r = buildCardDays({ ...base, days: [present("2026-10-01", 8), present("2026-10-02", 10), present("2026-10-03", 8), present("2026-10-09", 6)] });
  // 2026-10-02 is a Friday: the weekly off day, so its 10 hours are all overtime
  assert.deepEqual(r.days.find((d) => d.day === 1), { day: 1, in: "", out: "", overtime: "", total: "8" });
  assert.deepEqual(r.days.find((d) => d.day === 2), { day: 2, in: "", out: "", overtime: "10", total: "10" });
  assert.equal(r.totals.days, 4);
  // the 9th is a Friday too: its 6 hours are overtime as well
  assert.equal(r.totals.overtimeHours, "16");
});

test("absent and off days are marked and not counted; the standard shift prints only on days worked", () => {
  const r = buildCardDays({ ...base, inOut: "standard", days: [present("2026-10-05", 9), { date: "2026-10-06", status: "ABSENT", normalHours: null, otHours: null }, { date: "2026-10-07", status: "OFF", normalHours: null, otHours: null }] });
  assert.deepEqual(r.days.find((d) => d.day === 5), { day: 5, in: "07:00", out: "16:00", overtime: "1", total: "9" });
  assert.equal(r.days.find((d) => d.day === 6)?.total, "A");
  assert.equal(r.days.find((d) => d.day === 6)?.in, "");
  assert.equal(r.days.find((d) => d.day === 7)?.total, "OFF");
  assert.equal(r.totals.days, 1);
  assert.equal(r.days.length, 31);
});

test("the days of a month with 30 days stop at 30", () => {
  assert.equal(buildCardDays({ ...base, month: "2026-09", days: [] }).days.length, 30);
});

test("the card's grid runs 1 to 16 down the left and 17 to 31 down the right", () => {
  assert.equal(dayOfRow(0, 0), 1);
  assert.equal(dayOfRow(0, 15), 16);
  assert.equal(dayOfRow(1, 0), 17);
  assert.equal(dayOfRow(1, 14), 31);
  assert.equal(GEOM.grid.rowsY.length, 17);
  assert.equal(GEOM.grid.left.length, 6);
});

test("sheet cells add up across trades, with A and OFF kept when no hours were worked", () => {
  const sheet = (cells: [string, string][]) => ({ dailyHours: JSON.stringify(cells.map(([date, value]) => ({ date, label: "", value }))) });
  const days = rawDaysFromSheets([sheet([["2026-10-01", "4"], ["2026-10-02", "A"], ["2026-10-03", "OFF"]]), sheet([["2026-10-01", "5"], ["2026-10-02", ""]])]);
  assert.deepEqual(days.find((d) => d.date === "2026-10-01"), { date: "2026-10-01", status: "PRESENT", normalHours: 9, otHours: null });
  assert.equal(days.find((d) => d.date === "2026-10-02")?.status, "ABSENT");
  assert.equal(days.find((d) => d.date === "2026-10-03")?.status, "OFF");
});

test("a saved template is made safe: unknown keys dropped, texts limited, bad colours and times replaced", () => {
  const spec = readTimeCardSpec({ title: "  MY CARD  ", ink: "red", tint: "#abcdef", shiftIn: "25:99", shiftOut: "17:30", offsetXmm: "40", offsetYmm: "-1.26", labels: { name: "Worker", bogus: "x" }, signatures: ["A", "", "C"], showLogo: false });
  assert.equal(spec.title, "MY CARD");
  assert.equal(spec.ink, DEFAULT_SPEC.ink);
  assert.equal(spec.tint, "#abcdef");
  assert.equal(spec.shiftIn, "07:00");
  assert.equal(spec.shiftOut, "17:30");
  assert.equal(spec.offsetXmm, 15);
  assert.equal(spec.offsetYmm, -1.3);
  assert.equal(spec.labels.name, "Worker");
  assert.equal(spec.labels.site, "Site");
  assert.deepEqual(spec.signatures, ["A", "Foreman Signature", "C"]);
  assert.equal(spec.showLogo, false);
  assert.deepEqual(readTimeCardSpec(null), DEFAULT_SPEC);
});
