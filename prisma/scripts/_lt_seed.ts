import "dotenv/config";
import { writeFileSync } from "node:fs";
import { prisma } from "../../src/lib/db";
import { LETTER_PRESETS, presetHtml } from "../../src/lib/letterPresets";
import { htmlToText } from "../../src/lib/letterHtml";
(async () => {
  const branch = await prisma.branch.findFirstOrThrow({ where: { code: "MAIN" } });
  const ajay = await prisma.employee.findFirstOrThrow({ where: { branchId: branch.id, name: "Ajay Kumar" } });
  writeFileSync("/tmp/lt_orig.json", JSON.stringify({ id: ajay.id, payStructure: ajay.payStructure, basicSalary: ajay.basicSalary?.toString() ?? null, housingAllowance: ajay.housingAllowance?.toString() ?? null }));
  for (const key of ["salary-certificate", "warning-letter"]) {
    const p = LETTER_PRESETS.find((x) => x.key === key)!;
    await prisma.letterTemplate.create({ data: { branchId: branch.id, audience: "EMPLOYEE", name: p.name, category: p.category, title: p.title, presetKey: p.key, bodyHtml: presetHtml(p), remarksText: htmlToText(presetHtml(p)) } });
  }
  console.log("seeded; Ajay id", ajay.id);
  await prisma.$disconnect();
})();
