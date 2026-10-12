import { COUNTRIES, findCountryByName } from "@/lib/countries";

// People write nationality however they think of it: "India", "Indian",
// "INDIAN ", "Indain". The platform stores the country name from its country
// list ("India"), because that is what the flag and the filters key on. This
// reads whatever was written and returns that name — or says it can't.

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, "");

// What a demonym or abbreviation stands for. Keys are normalised (lower-case letters only).
const ALIASES: Record<string, string> = {
  indian: "India", bharat: "India", ind: "India",
  nepali: "Nepal", nepalese: "Nepal", nepal: "Nepal",
  pakistani: "Pakistan", pak: "Pakistan",
  bangladeshi: "Bangladesh", bd: "Bangladesh",
  srilankan: "Sri Lanka", lankan: "Sri Lanka", ceylon: "Sri Lanka",
  filipino: "Philippines", filipina: "Philippines", philippine: "Philippines", phillipines: "Philippines", pilipino: "Philippines",
  egyptian: "Egypt", sudanese: "Sudan", ethiopian: "Ethiopia", eritrean: "Eritrea", somali: "Somalia",
  kenyan: "Kenya", ugandan: "Uganda", tanzanian: "Tanzania", rwandan: "Rwanda", burundian: "Burundi",
  nigerian: "Nigeria", ghanaian: "Ghana", cameroonian: "Cameroon", senegalese: "Senegal", malian: "Mali",
  ivorian: "Côte d'Ivoire", ivorycoast: "Côte d'Ivoire", cotedivoire: "Côte d'Ivoire",
  zimbabwean: "Zimbabwe", zambian: "Zambia", malawian: "Malawi", mozambican: "Mozambique", ugandans: "Uganda",
  moroccan: "Morocco", tunisian: "Tunisia", algerian: "Algeria", libyan: "Libya",
  jordanian: "Jordan", syrian: "Syria", lebanese: "Lebanon", palestinian: "Palestine", iraqi: "Iraq", iranian: "Iran", persian: "Iran",
  yemeni: "Yemen", omani: "Oman", saudi: "Saudi Arabia", saudiarabian: "Saudi Arabia", ksa: "Saudi Arabia",
  kuwaiti: "Kuwait", bahraini: "Bahrain", qatari: "Qatar", emirati: "United Arab Emirates", uae: "United Arab Emirates",
  emirates: "United Arab Emirates", unitedarabemirates: "United Arab Emirates", arabemirates: "United Arab Emirates",
  afghan: "Afghanistan", afghani: "Afghanistan", uzbek: "Uzbekistan", kazakh: "Kazakhstan", tajik: "Tajikistan", turkmen: "Turkmenistan",
  indonesian: "Indonesia", malaysian: "Malaysia", thai: "Thailand", vietnamese: "Vietnam", burmese: "Myanmar", myanmarese: "Myanmar",
  cambodian: "Cambodia", laotian: "Laos", chinese: "China", japanese: "Japan", korean: "South Korea", southkorean: "South Korea",
  mongolian: "Mongolia", singaporean: "Singapore", bhutanese: "Bhutan", maldivian: "Maldives",
  turkish: "Turkey", turk: "Turkey", georgian: "Georgia", armenian: "Armenia", azerbaijani: "Azerbaijan",
  russian: "Russia", ukrainian: "Ukraine", belarusian: "Belarus", polish: "Poland", romanian: "Romania", bulgarian: "Bulgaria",
  british: "United Kingdom", english: "United Kingdom", uk: "United Kingdom", scottish: "United Kingdom", irish: "Ireland",
  american: "United States", usa: "United States", us: "United States", unitedstatesofamerica: "United States",
  canadian: "Canada", australian: "Australia", newzealander: "New Zealand", kiwi: "New Zealand",
  french: "France", german: "Germany", italian: "Italy", spanish: "Spain", portuguese: "Portugal", dutch: "Netherlands",
  greek: "Greece", swiss: "Switzerland", swedish: "Sweden", norwegian: "Norway", danish: "Denmark", finnish: "Finland",
  brazilian: "Brazil", argentinian: "Argentina", argentine: "Argentina", mexican: "Mexico", colombian: "Colombia", peruvian: "Peru", chilean: "Chile",
  southafrican: "South Africa", congolese: "Congo", angolan: "Angola", namibian: "Namibia", botswanan: "Botswana", mauritian: "Mauritius",
};

// A region is not a nationality: nothing should be saved from it.
const REGIONS = new Set(["asian", "african", "arab", "arabic", "european", "gulf", "gcc", "american", "westafrican", "eastafrican", "southasian", "middleeastern"]);
// Placeholders people type when they have nothing to say.
const NOTHING = new Set(["na", "nil", "none", "unknown", "other", "notavailable", "notknown", "tbc", "tbd"]);
// "American" is both a region and a demonym; here it means the US.
REGIONS.delete("american");

const BY_KEY = new Map<string, string>();
for (const c of COUNTRIES) BY_KEY.set(norm(c.name), c.name);
for (const [k, v] of Object.entries(ALIASES)) if (findCountryByName(v)) BY_KEY.set(k, findCountryByName(v)!.name);

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const m = a.length, n = b.length;
  if (!m || !n) return 0;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      // "indain" -> "indian" is one swap, not two edits
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return 1 - d[m][n] / Math.max(m, n);
}

export type NationalityResult = {
  /** The country name to save, or null when nothing should be saved. */
  value: string | null;
  /** ok = already right; fixed = understood and corrected; region / unknown = not saved. */
  status: "empty" | "ok" | "fixed" | "region" | "unknown";
};

export function normalizeNationality(raw: string | null | undefined): NationalityResult {
  const text = (raw ?? "").trim();
  if (!text) return { value: null, status: "empty" };
  const key = norm(text);
  if (!key) return { value: null, status: "unknown" };
  if (NOTHING.has(key)) return { value: null, status: "empty" };
  if (REGIONS.has(key)) return { value: null, status: "region" };

  const hit = BY_KEY.get(key);
  if (hit) return { value: hit, status: hit === text ? "ok" : "fixed" };

  // A typo ("Indain", "Banglades"): take the single clearly-closest known name.
  if (key.length >= 4) {
    let best = { name: "", score: 0 }, second = 0;
    for (const [k, name] of BY_KEY) {
      if (Math.abs(k.length - key.length) > 3) continue;
      const s = similarity(key, k);
      if (s > best.score) { second = best.name !== name ? best.score : second; best = { name, score: s }; }
      else if (s > second && name !== best.name) second = s;
    }
    if (best.score >= 0.8 && best.score - second >= 0.05) return { value: best.name, status: "fixed" };
  }
  return { value: null, status: "unknown" };
}
