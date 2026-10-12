import { appHref } from "./content";

/** The three separate logins. Previously only the staff one was in the
 * header and the other two were footer-only, so portal users had to hunt. */
export const SIGN_INS = [
  { label: "Staff workspace", href: appHref("/login"), description: "Office, HR, payroll and admin users." },
  { label: "Employee portal", href: appHref("/me/login"), description: "Payslips, documents and leave requests." },
  { label: "Supplier portal", href: appHref("/vendor/login"), description: "Sub-suppliers submitting workers and hours." },
];
