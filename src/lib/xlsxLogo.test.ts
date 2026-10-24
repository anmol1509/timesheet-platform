import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { addSheetLogo, fitInside, imageSize, rightEdgeColumn } from "./xlsxLogo";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("a PNG data URI is placed on the sheet; anything else is skipped", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("t");
  assert.equal(addSheetLogo(wb, ws, PNG), true);
  assert.equal(addSheetLogo(wb, ws, null), false);
  assert.equal(addSheetLogo(wb, ws, "data:image/svg+xml;base64,AAAA"), false);
  assert.equal(addSheetLogo(wb, ws, "not an image"), false);
  const back = new ExcelJS.Workbook();
  await back.xlsx.load(await wb.xlsx.writeBuffer());
  assert.equal(back.getWorksheet("t")!.getImages().length, 1);
});

test("the right-edge column leaves room for the logo", () => {
  assert.equal(rightEdgeColumn([6, 12, 26, 16, 10], 96), 3);
  assert.equal(rightEdgeColumn([6, 6, 6, 6, 6, 6], 96), 3);
  assert.equal(rightEdgeColumn([3], 96), 0);
});

test("a logo keeps its proportions inside the box", () => {
  assert.deepEqual(fitInside({ width: 400, height: 400 }, 96, 48), { width: 48, height: 48 });
  assert.deepEqual(fitInside({ width: 400, height: 100 }, 96, 48), { width: 96, height: 24 });
  assert.deepEqual(fitInside({ width: 40, height: 20 }, 96, 48), { width: 96, height: 48 });
  assert.deepEqual(fitInside(null, 96, 48), { width: 96, height: 48 });
});

test("image size is read from a PNG header", () => {
  const png = Buffer.from(PNG.split(",")[1], "base64");
  assert.deepEqual(imageSize(png), { width: 1, height: 1 });
  assert.equal(imageSize(Buffer.from("hello world, not an image at all")), null);
});
