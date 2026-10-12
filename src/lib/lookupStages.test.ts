import test from "node:test";
import assert from "node:assert/strict";
import { stagesFor } from "./lookupCategories";

test("with nothing configured the stage dropdowns offer the built-in stages", () => {
  const visa = stagesFor("VISA_APPLICATION_STAGE", undefined).map((s) => s.value);
  assert.ok(visa.includes("Applied") && visa.includes("Visa stamped"));
  assert.ok(stagesFor("LABOUR_CARD_APPLICATION_STAGE", []).some((s) => s.value === "Issued"));
});

test("configured stages replace the built-in ones", () => {
  assert.deepEqual(stagesFor("VISA_APPLICATION_STAGE", [{ value: "Custom" }]), [{ value: "Custom" }]);
});
