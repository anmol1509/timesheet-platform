import { LETTER_MERGE_FIELDS, type LetterWorker } from "@/lib/letterLayout";
import { substituteMergeFields } from "@/lib/mergeFields";

/** Sample values for every merge field — used by the live preview and the sample PDF. */
export const SAMPLE_VALUES: Record<string, string> = Object.fromEntries(LETTER_MERGE_FIELDS.map((f) => [f.key, f.example]));

export const SAMPLE_WORKERS: LetterWorker[] = [
  { id: "s1", name: "Ajay Kumar", employeeIdNo: "EMP-001", trade: "Helper", nationality: "India", passportNumber: "N1234567", emiratesId: "784-1990-1234567-1", visaStatus: "Employment", supplierId: "sample", supplierName: SAMPLE_VALUES.COMPANYNAME },
  { id: "s2", name: "Arbaj Ali", employeeIdNo: "EMP-002", trade: "Steel Fixer", nationality: "Pakistan", passportNumber: "AB7654321", emiratesId: "784-1988-7654321-2", visaStatus: "Employment", supplierId: "sample", supplierName: SAMPLE_VALUES.COMPANYNAME },
  { id: "s3", name: "Narendra BK", employeeIdNo: "EMP-003", trade: "Carpenter", nationality: "Nepal", passportNumber: "P9988776", emiratesId: "784-1992-9988776-3", visaStatus: "Employment", supplierId: "sample", supplierName: SAMPLE_VALUES.COMPANYNAME },
];

export const sampleBody = (body: string) => substituteMergeFields(body, SAMPLE_VALUES);
