/** Legal forward moves for a quotation. Shared by the server action (which enforces them) and the board (which only offers legal drops). CONVERTED is set only by converting to a project. */
export const QUOTATION_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["SENT"],
  SENT: ["NEGOTIATION", "APPROVED", "REJECTED"],
  NEGOTIATION: ["APPROVED", "REJECTED"],
  APPROVED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
  CONVERTED: [],
};

export const QUOTATION_COLUMNS = ["DRAFT", "SENT", "NEGOTIATION", "APPROVED", "ACCEPTED", "CONVERTED", "REJECTED"] as const;
export const ENQUIRY_COLUMNS = ["Open", "Quoted", "Converted", "Lost"] as const;
