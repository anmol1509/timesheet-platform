import type { FieldDef, ImportKind } from "./types";

// What each kind of import can fill in, and the names people give those
// columns in the sheets they already keep. The aliases are what make a file
// line up without the customer renaming anything.

const SUPPLIERS: FieldDef[] = [
  { key: "name", label: "Supplier name", required: true, aliases: ["supplier", "supplier name", "main supplier", "company", "company name", "vendor", "vendor name", "name"] },
  { key: "code", label: "Supplier code", aliases: ["code", "supplier code", "vendor code", "supplier id", "supplier no"] },
  { key: "parent", label: "Parent supplier", aliases: ["parent", "parent company", "main company", "group", "under", "sub of"] },
  { key: "fullName", label: "Full name (letterhead)", aliases: ["full name", "legal name", "trade name", "registered name"] },
  { key: "contactPerson", label: "Contact person", aliases: ["contact person", "contact", "contact name", "representative", "poc", "point of contact"] },
  { key: "contactPhone", label: "Contact phone", aliases: ["phone", "mobile", "contact phone", "contact number", "tel", "telephone", "phone number"] },
  { key: "contactEmail", label: "Contact email", aliases: ["email", "e-mail", "contact email", "email address"] },
  { key: "tradeLicenseNumber", label: "Trade licence number", aliases: ["trade license", "trade licence", "trade license number", "licence no", "license no", "tl no", "tl number"] },
  { key: "category", label: "Category", aliases: ["category", "type", "supplier type", "business type"] },
  { key: "trn", label: "TRN", aliases: ["trn", "tax registration number", "vat number", "vat no", "tax id", "vat trn"] },
];

const CLIENTS: FieldDef[] = [
  { key: "name", label: "Company name", required: true, aliases: ["client", "client name", "customer", "customer name", "company", "company name", "name"] },
  { key: "code", label: "Client code", aliases: ["code", "client code", "customer code", "client id", "customer id"] },
  { key: "contactPerson", label: "Contact person", aliases: ["contact person", "contact", "contact name", "representative", "poc"] },
  { key: "contactPhone", label: "Contact phone", aliases: ["phone", "mobile", "contact phone", "contact number", "tel", "telephone"] },
  { key: "contactEmail", label: "Contact email", aliases: ["email", "e-mail", "contact email", "email address"] },
  { key: "trn", label: "TRN", aliases: ["trn", "tax registration number", "vat number", "vat no", "tax id"] },
  { key: "tradeLicenseNumber", label: "Trade licence number", aliases: ["trade license", "trade licence", "trade license number", "licence no", "license no"] },
  { key: "billingAddress", label: "Billing address", aliases: ["address", "billing address", "office address"] },
  { key: "paymentTerms", label: "Payment terms", aliases: ["payment terms", "terms", "credit terms", "credit period"] },
];

const WORKERS: FieldDef[] = [
  { key: "employeeIdNo", label: "Employee code", required: true, aliases: ["id", "employee code", "emp code", "id no", "i d no", "emp id", "emp no", "employee id", "employee no", "employee code", "staff id", "worker id", "labour id", "badge", "badge no", "code"] },
  { key: "name", label: "Worker name", required: true, aliases: ["employee name", "worker name", "emp name", "name", "full name", "staff name", "labour name"] },
  { key: "trade", label: "Trade", aliases: ["trade", "designation", "job title", "position", "profession", "occupation", "skill"] },
  { key: "supplier", label: "Supplier", aliases: ["supplier", "main supplier", "company", "employer", "agency", "manpower supplier", "supplier name"] },
  { key: "sponsor", label: "Sponsor", aliases: ["sponsor", "sponsor name", "sponsor company", "visa company", "visa sponsor"] },
  { key: "nationality", label: "Nationality", aliases: ["nationality", "country", "citizenship"] },
  { key: "mobileNumber", label: "Mobile number", aliases: ["mobile", "mobile no", "phone", "phone number", "contact number", "contact no", "cell"] },
  { key: "gender", label: "Gender", aliases: ["gender", "sex"] },
  { key: "dateOfBirth", label: "Date of birth", aliases: ["dob", "date of birth", "birth date", "birthday"] },
  { key: "joinDate", label: "Joining date", aliases: ["join date", "joining date", "date of joining", "doj", "start date", "hire date"] },
  { key: "passportNumber", label: "Passport number", aliases: ["passport", "passport no", "passport number"] },
  { key: "passportExpiry", label: "Passport expiry", aliases: ["passport expiry", "passport exp", "passport expiry date"] },
  { key: "emiratesId", label: "Emirates ID", aliases: ["emirates id", "eid", "eid no", "emirates id no", "emirates id number"] },
  { key: "emiratesIdExpiry", label: "Emirates ID expiry", aliases: ["eid expiry", "emirates id expiry", "eid exp", "emirates id expiry date"] },
  { key: "visaExpiry", label: "Visa expiry", aliases: ["visa expiry", "visa exp", "visa expiry date", "residence expiry"] },
  { key: "laborCardNumber", label: "Labour card number", aliases: ["labour card", "labor card", "labour card no", "labor card no", "work permit", "work permit no", "mol no"] },
  { key: "laborCardExpiry", label: "Labour card expiry", aliases: ["labour card expiry", "labor card expiry", "work permit expiry", "wp expiry"] },
];

const CAMPS: FieldDef[] = [
  { key: "camp", label: "Camp name", required: true, aliases: ["camp", "camp name", "accommodation", "accommodation name", "building", "building name", "property"] },
  { key: "campType", label: "Camp type", aliases: ["camp type", "type", "ownership", "owned by type", "own/supplier/client"], hint: "Own, Supplier or Client" },
  { key: "owner", label: "Supplier or client name", aliases: ["supplier", "client", "owner", "provided by", "camp owner", "supplier name", "client name", "landlord"] },
  { key: "room", label: "Room", aliases: ["room", "room no", "room number", "room name", "flat", "unit"] },
  { key: "roomType", label: "Room type", aliases: ["room type", "category", "bed type"] },
  { key: "beds", label: "Number of beds", aliases: ["beds", "no of beds", "number of beds", "bed count", "bed space", "capacity", "bed spaces"] },
  { key: "nationality", label: "Nationality", aliases: ["nationality", "reserved for", "country"] },
  { key: "employee", label: "Employee name", aliases: ["employee name (optional)", "employee", "employee name", "emp name", "worker", "worker name", "name", "occupant", "staff name", "resident"], hint: "Places this worker in a bed" },
  { key: "employeeCode", label: "Employee code", aliases: ["employee code (optional)", "employee code", "emp code", "emp id", "employee id", "id no", "worker id", "staff id", "code"], hint: "Only needed if two workers share a name" },
  { key: "bed", label: "Bed", aliases: ["bed (optional)", "bed", "bed no", "bed number", "bed label"], hint: "Blank = first free bed" },
];

const VEHICLES: FieldDef[] = [
  { key: "plateNumber", label: "Plate number", required: true, aliases: ["plate", "plate no", "plate number", "vehicle no", "vehicle number", "registration no", "reg no", "number plate", "vehicle"] },
  { key: "type", label: "Vehicle type", aliases: ["type", "vehicle type", "model", "make", "category"] },
  { key: "capacity", label: "Seats", aliases: ["capacity", "seats", "seating", "seating capacity", "passengers", "no of seats"] },
  { key: "status", label: "Status", aliases: ["status", "condition", "state"] },
  { key: "driverName", label: "Driver name", aliases: ["driver", "driver name", "driver's name"] },
  { key: "driverPhone", label: "Driver phone", aliases: ["driver phone", "driver mobile", "driver contact", "driver number", "phone", "mobile"] },
  { key: "registrationExpiry", label: "Registration (Mulkiya) expiry", aliases: ["mulkiya", "mulkiya expiry", "registration expiry", "reg expiry", "registration exp", "istimara expiry"] },
  { key: "insuranceExpiry", label: "Insurance expiry", aliases: ["insurance", "insurance expiry", "insurance exp", "policy expiry"] },
  { key: "notes", label: "Notes", aliases: ["notes", "remarks", "comments"] },
];

const TIMESHEETS: FieldDef[] = [
  { key: "idNo", label: "Worker ID", required: true, aliases: ["id no", "i d no", "emp id", "employee id", "id"] },
  { key: "name", label: "Worker name", required: true, aliases: ["employee name", "worker name", "name"] },
  { key: "supplier", label: "Supplier", required: true, aliases: ["supplier", "main supplier", "supplier name", "company"] },
  { key: "sponsor", label: "Sponsor", aliases: ["sponsor", "sponsor name"] },
  { key: "client", label: "Client", aliases: ["client name", "client", "customer"] },
  { key: "site", label: "Site", aliases: ["site", "project", "location"] },
  { key: "trade", label: "Trade", aliases: ["trade", "designation"] },
  { key: "rate", label: "Rate", aliases: ["rate", "sale rate", "hourly rate", "billing rate"] },
  { key: "nationality", label: "Nationality", aliases: ["nationality"] },
];

export const TARGETS: Record<ImportKind, { label: string; noun: string; fields: FieldDef[] }> = {
  SUPPLIERS: { label: "Suppliers", noun: "supplier", fields: SUPPLIERS },
  CLIENTS: { label: "Clients", noun: "client", fields: CLIENTS },
  WORKERS: { label: "Workers", noun: "worker", fields: WORKERS },
  TIMESHEETS: { label: "Timesheets", noun: "timesheet row", fields: TIMESHEETS },
  CAMPS: { label: "Camps", noun: "camp", fields: CAMPS },
  VEHICLES: { label: "Vehicles", noun: "vehicle", fields: VEHICLES },
};

export function isImportKind(v: string): v is ImportKind {
  return v in TARGETS;
}
