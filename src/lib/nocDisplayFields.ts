type NocEmployeeSource = {
  employeeIdNo: string;
  name: string;
  passportNumber: string | null;
  nationality: string | null;
  trade: string | null;
  emiratesId: string | null;
  visaStatus: string | null;
};

export const NOC_DISPLAY_FIELDS: {
  key: string;
  label: string;
  resolve: (employee: NocEmployeeSource) => string;
}[] = [
  { key: "NAME", label: "Name", resolve: (e) => e.name },
  { key: "EMPLOYEE_ID", label: "Employee ID", resolve: (e) => e.employeeIdNo },
  { key: "PASSPORT_NO", label: "Passport No", resolve: (e) => e.passportNumber ?? "" },
  { key: "NATIONALITY", label: "Nationality", resolve: (e) => e.nationality ?? "" },
  { key: "TRADE", label: "Trade", resolve: (e) => e.trade ?? "" },
  { key: "EMIRATES_ID", label: "Emirates ID", resolve: (e) => e.emiratesId ?? "" },
  { key: "VISA_STATUS", label: "Visa Status", resolve: (e) => e.visaStatus ?? "" },
];

export const DEFAULT_NOC_DISPLAY_FIELDS = ["NAME", "EMPLOYEE_ID", "PASSPORT_NO", "NATIONALITY", "TRADE", "EMIRATES_ID"];
