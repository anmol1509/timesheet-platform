import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMPLOYEE_CHILDREN } from "./trashConfig";

const schema = readFileSync(join(process.cwd(), "prisma/schema.prisma"), "utf8");
const models = new Map([...schema.matchAll(/\nmodel (\w+) \{([\s\S]*?)\n\}/g)].map((m) => [m[1], m[2]]));

/** Models whose rows are deleted by the database when `parent` is deleted. */
function cascadeChildren(parent: string): { model: string; fk: string }[] {
  const out: { model: string; fk: string }[] = [];
  for (const [name, body] of models) {
    for (const line of body.split("\n")) {
      const m = line.match(new RegExp(`^\\s+\\w+\\s+${parent}\\??\\s+@relation\\(([^)]*)\\)`));
      if (m && /onDelete:\s*Cascade/.test(m[1])) out.push({ model: name, fk: /fields:\s*\[(\w+)\]/.exec(m[1])![1] });
    }
  }
  return out;
}

test("everything the database deletes with a worker is kept in the snapshot", () => {
  const inSchema = cascadeChildren("Employee").map((c) => c.model).sort();
  const kept = EMPLOYEE_CHILDREN.map((c) => c.model).sort();
  assert.deepEqual(kept, inSchema, "A table was added or changed that is deleted with a worker: add it to EMPLOYEE_CHILDREN so it comes back on restore.");
});

test("each kept table is found by the right column", () => {
  const fks = new Map(cascadeChildren("Employee").map((c) => [c.model, c.fk]));
  for (const c of EMPLOYEE_CHILDREN) assert.equal(fks.get(c.model), c.fk, c.model);
});

test("the tables deleted with those tables are covered too", () => {
  const kept = new Set<string>(EMPLOYEE_CHILDREN.map((c) => c.model));
  for (const c of EMPLOYEE_CHILDREN) for (const g of cascadeChildren(c.model)) assert.ok(kept.has(g.model), `${g.model} is deleted with ${c.model} but is not kept`);
});

test("notes come before documents, and documents before the applications that point at them", () => {
  const order = EMPLOYEE_CHILDREN.map((c) => c.model as string);
  assert.ok(order.indexOf("EmployeeNote") < order.indexOf("Document"));
  assert.ok(order.indexOf("Document") < order.indexOf("VisaApplication"));
  assert.ok(order.indexOf("Document") < order.indexOf("LabourCardApplication"));
});
