import { describe, expect, it } from "vitest";
import { withoutSummaryTable } from "./letterHtml";

describe("withoutSummaryTable", () => {
  const marker = '<div data-worker-table="1"></div>';
  it("drops the details box before the worker list and keeps the rest", () => {
    const html = `<p>We undertake</p><table><tbody><tr><td>Supplied to</td><td>X</td></tr></tbody></table>${marker}<p>After</p>`;
    expect(withoutSummaryTable(html)).toBe(`<p>We undertake</p>${marker}<p>After</p>`);
  });
  it("leaves a letter without a worker list alone", () => {
    const html = "<table><tbody><tr><td>a</td></tr></tbody></table>";
    expect(withoutSummaryTable(html)).toBe(html);
  });
});
