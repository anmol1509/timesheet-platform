/** One-line, plain-English meanings for the payroll words people meet and don't know. */
export const GLOSSARY = {
  WPS: "Wage Protection System: the UAE system that checks salaries are paid on time through a bank or exchange house.",
  SIF: "The salary file your bank needs. It lists who gets paid how much. Upload it in your bank's online portal.",
  MOHRE: "Your company's establishment ID with the Ministry of Human Resources and Emiratisation (the labour ministry).",
  MOL_PERSON_CODE: "A 14-digit code on the worker's labour card. WPS uses it to match the payment to the person.",
  ROUTING_CODE: "A 9-digit code that identifies the worker's bank for WPS. Your bank or the WPS file guide lists it.",
  IBAN: "The worker's bank account number in international format. In the UAE it starts with AE and has 23 characters.",
  PAYER_BANK: "The company bank account that salaries are paid from.",
  PAY_STRUCTURE: "How a worker is paid: a basic salary plus allowances, one fixed monthly rate, or per hour worked.",
  NET_PAY: "What the worker actually receives: earnings minus deductions.",
  ARREARS: "Pay that was owed for earlier months, for example after a raise that started in a month already paid.",
  GRATUITY: "End-of-service payment due to a worker who leaves after at least one year.",
  CORRECTION: "A one-off amount added to, or taken off, next month's pay to fix something in a month already approved.",
  TIMESHEET: "The client timesheet: the hours each worker was reported to have worked, which the client approves.",
} as const;
export type GlossaryKey = keyof typeof GLOSSARY;
