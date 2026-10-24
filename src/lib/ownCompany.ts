/**
 * Which of an own company's files stay open to everyone who can see its page. Letters and NOCs print the letterhead,
 * and the workmen's compensation certificates cover workers on site, so those keep working for the people who run them.
 * Every other company file (trade licence, tenancy, establishment card, contracts...) opens only for admins and roles
 * granted My Companies.
 */
const OPEN_TO_ALL = new Set(["LETTERHEAD", "WORKMEN_COMPENSATION_INSURANCE", "WORKMEN_COMPENSATION"]);

export function ownDocIsConfidential(docType: string): boolean {
  return !OPEN_TO_ALL.has(docType);
}
