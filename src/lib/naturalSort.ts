/** Orders names the way a person reads them: Room 2 before Room 10, 101 before 1010, A-2 before A-10. */
export const compareNatural = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
export const byNameNatural = <T extends { name: string }>(list: T[]): T[] => [...list].sort((x, y) => compareNatural(x.name, y.name));
