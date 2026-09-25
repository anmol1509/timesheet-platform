/** Emirates and main cities of the UAE (where this business operates), then major cities for the countries suppliers and workers come from. */
export const UAE_CITIES = [
  "Abu Dhabi", "Al Ain", "Dubai", "Jebel Ali", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah", "Khor Fakkan", "Ruwais", "Madinat Zayed",
];

export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  "United Arab Emirates": UAE_CITIES,
  "Saudi Arabia": ["Riyadh", "Jeddah", "Dammam", "Mecca", "Medina", "Khobar", "Jubail", "Tabuk"],
  Qatar: ["Doha", "Al Rayyan", "Al Wakrah", "Lusail"],
  Kuwait: ["Kuwait City", "Hawalli", "Salmiya", "Ahmadi"],
  Oman: ["Muscat", "Salalah", "Sohar", "Nizwa"],
  Bahrain: ["Manama", "Muharraq", "Riffa"],
  India: ["Mumbai", "Delhi", "Bengaluru", "Chennai", "Hyderabad", "Kolkata", "Kochi", "Ahmedabad", "Pune", "Lucknow", "Jaipur"],
  Pakistan: ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Peshawar", "Multan"],
  Bangladesh: ["Dhaka", "Chittagong", "Sylhet", "Khulna", "Rajshahi"],
  Nepal: ["Kathmandu", "Pokhara", "Lalitpur", "Biratnagar"],
  "Sri Lanka": ["Colombo", "Kandy", "Galle", "Jaffna"],
  Philippines: ["Manila", "Quezon City", "Cebu", "Davao"],
  Egypt: ["Cairo", "Alexandria", "Giza", "Port Said"],
  Jordan: ["Amman", "Zarqa", "Irbid", "Aqaba"],
  "United Kingdom": ["London", "Manchester", "Birmingham", "Glasgow"],
  "United States": ["New York", "Los Angeles", "Chicago", "Houston"],
};

/** Cities for a country. Empty/unknown country falls back to the UAE, where this business is based. */
export function citiesFor(country: string | null | undefined): string[] | null {
  if (!country) return UAE_CITIES;
  return CITIES_BY_COUNTRY[country] ?? null;
}
