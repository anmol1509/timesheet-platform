// What a delete takes with it. Kept apart from the code that talks to the database so a test can check it against the schema.

/** What is deleted together with a worker, in the order it has to be put back (notes before documents, documents before applications). */
export const EMPLOYEE_CHILDREN = [
  { model: "EmployeeNote", delegate: "employeeNote", fk: "employeeId" },
  { model: "EmployeeAssignmentHistory", delegate: "employeeAssignmentHistory", fk: "employeeId" },
  { model: "AccommodationHistory", delegate: "accommodationHistory", fk: "employeeId" },
  { model: "EmployeeVaccination", delegate: "employeeVaccination", fk: "employeeId" },
  { model: "EmployeeInventoryAssignment", delegate: "employeeInventoryAssignment", fk: "employeeId" },
  { model: "EmployeeSkill", delegate: "employeeSkill", fk: "employeeId" },
  { model: "CampCheckIn", delegate: "campCheckIn", fk: "employeeId" },
  { model: "Document", delegate: "document", fk: "employeeId" },
  { model: "VisaApplication", delegate: "visaApplication", fk: "employeeId" },
  { model: "LabourCardApplication", delegate: "labourCardApplication", fk: "employeeId" },
] as const;

