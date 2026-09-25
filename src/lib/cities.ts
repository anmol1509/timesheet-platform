import { COUNTRIES } from "@/lib/countries";

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
  Afghanistan: ["Kabul", "Kandahar", "Herat", "Mazar-i-Sharif"],
  Algeria: ["Algiers", "Oran", "Constantine"],
  Argentina: ["Buenos Aires", "Córdoba", "Rosario"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth"],
  Austria: ["Vienna", "Graz", "Salzburg"],
  Belgium: ["Brussels", "Antwerp", "Ghent"],
  Brazil: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador"],
  Canada: ["Toronto", "Vancouver", "Montreal", "Calgary"],
  China: ["Shanghai", "Beijing", "Shenzhen", "Guangzhou", "Hong Kong"],
  Denmark: ["Copenhagen", "Aarhus"],
  Ethiopia: ["Addis Ababa", "Dire Dawa"],
  France: ["Paris", "Marseille", "Lyon", "Nice"],
  Germany: ["Berlin", "Munich", "Hamburg", "Frankfurt"],
  Ghana: ["Accra", "Kumasi", "Tamale"],
  Greece: ["Athens", "Thessaloniki"],
  "Hong Kong": ["Hong Kong"],
  Indonesia: ["Jakarta", "Surabaya", "Bandung", "Medan"],
  Iran: ["Tehran", "Isfahan", "Shiraz", "Mashhad"],
  Iraq: ["Baghdad", "Basra", "Erbil", "Mosul"],
  Ireland: ["Dublin", "Cork", "Galway"],
  Israel: ["Tel Aviv", "Jerusalem", "Haifa"],
  Italy: ["Rome", "Milan", "Naples", "Turin"],
  Japan: ["Tokyo", "Osaka", "Nagoya", "Yokohama"],
  Kazakhstan: ["Almaty", "Astana", "Shymkent"],
  Kenya: ["Nairobi", "Mombasa", "Kisumu"],
  Lebanon: ["Beirut", "Tripoli", "Sidon"],
  Libya: ["Tripoli", "Benghazi"],
  Malaysia: ["Kuala Lumpur", "Johor Bahru", "Penang", "Ipoh"],
  Mexico: ["Mexico City", "Guadalajara", "Monterrey"],
  Morocco: ["Casablanca", "Rabat", "Marrakesh", "Tangier"],
  Myanmar: ["Yangon", "Mandalay", "Naypyidaw"],
  Netherlands: ["Amsterdam", "Rotterdam", "The Hague"],
  "New Zealand": ["Auckland", "Wellington", "Christchurch"],
  Nigeria: ["Lagos", "Abuja", "Kano", "Port Harcourt"],
  Norway: ["Oslo", "Bergen"],
  Palestine: ["Ramallah", "Gaza", "Nablus", "Hebron"],
  Poland: ["Warsaw", "Kraków", "Gdańsk"],
  Portugal: ["Lisbon", "Porto"],
  Romania: ["Bucharest", "Cluj-Napoca"],
  Russia: ["Moscow", "Saint Petersburg", "Kazan", "Novosibirsk"],
  Singapore: ["Singapore"],
  "South Africa": ["Johannesburg", "Cape Town", "Durban", "Pretoria"],
  "South Korea": ["Seoul", "Busan", "Incheon"],
  Spain: ["Madrid", "Barcelona", "Valencia", "Seville"],
  Sudan: ["Khartoum", "Omdurman", "Port Sudan"],
  Sweden: ["Stockholm", "Gothenburg", "Malmö"],
  Switzerland: ["Zurich", "Geneva", "Basel"],
  Syria: ["Damascus", "Aleppo", "Homs"],
  Taiwan: ["Taipei", "Kaohsiung", "Taichung"],
  Tanzania: ["Dar es Salaam", "Dodoma", "Arusha", "Zanzibar"],
  Thailand: ["Bangkok", "Chiang Mai", "Phuket", "Pattaya"],
  Tunisia: ["Tunis", "Sfax", "Sousse"],
  Turkey: ["Istanbul", "Ankara", "Izmir", "Antalya"],
  Uganda: ["Kampala", "Entebbe", "Jinja"],
  Ukraine: ["Kyiv", "Kharkiv", "Odesa", "Lviv"],
  Uzbekistan: ["Tashkent", "Samarkand", "Bukhara"],
  Vietnam: ["Ho Chi Minh City", "Hanoi", "Da Nang"],
  Yemen: ["Sanaa", "Aden", "Taiz"],
  Zambia: ["Lusaka", "Kitwe", "Ndola"],
  Zimbabwe: ["Harare", "Bulawayo"],
};

/** Cities for a country. Empty/unknown country falls back to the UAE, where this business is based. */
export function citiesFor(country: string | null | undefined): string[] | null {
  if (!country) return UAE_CITIES;
  return CITIES_BY_COUNTRY[country] ?? null;
}

/** The dial code (e.g. "+91") for a country name, or null if unknown. */
export function dialForCountry(country: string | null | undefined): string | null {
  if (!country) return null;
  return COUNTRIES.find((c) => c.name === country)?.dial ?? null;
}
