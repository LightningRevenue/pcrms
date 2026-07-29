// Romanian CAEN Rev. 2 activity codes → the curated INDUSTRIES list in lib/firmographics.ts.
//
// Romanian company registries export the activity as "7911 - Activitati ale agentiilor
// turistice". Importing that verbatim leaves a value nobody can filter on next to the English
// industries everyone else uses, so a leading CAEN code is transcoded to its industry and the
// Romanian label is dropped. Anything that isn't a recognised code passes through untouched —
// global imports that already say "Manufacturing" are unaffected.
//
// The table is keyed by division (2 digits) because CAEN is hierarchical: 7911 lives under 79,
// so ~88 divisions cover all ~600 codes. Divisions that would collapse genuinely different
// industries (69 = legal + accounting) get 3- or 4-digit entries, which win over the division.

import { INDUSTRIES } from "./firmographics";

type Industry = (typeof INDUSTRIES)[number];

// Longest-prefix wins: a 4-digit key beats a 3-digit key beats the division. Only add the
// longer keys where the division alone maps to the wrong industry.
const CAEN_TO_INDUSTRY: Record<string, Industry> = {
  // A — Agriculture, forestry, fishing
  "01": "Agriculture",
  "02": "Agriculture",
  "03": "Agriculture",

  // B — Mining
  "05": "Mining & Metals",
  "06": "Oil & Energy",
  "07": "Mining & Metals",
  "08": "Mining & Metals",
  "09": "Mining & Metals",

  // C — Manufacturing
  "10": "Food & Beverages",
  "11": "Food & Beverages",
  "12": "Consumer Goods",
  "13": "Textiles",
  "14": "Apparel & Fashion",
  "15": "Apparel & Fashion",
  "16": "Building Materials",
  "17": "Packaging & Containers",
  "18": "Printing",
  "19": "Oil & Energy",
  "20": "Chemicals",
  "21": "Pharmaceuticals",
  "22": "Chemicals",
  "23": "Building Materials",
  "24": "Mining & Metals",
  "25": "Manufacturing",
  "26": "Electrical & Electronic Manufacturing",
  "2611": "Semiconductors",
  "2620": "Computer Hardware",
  "27": "Electrical & Electronic Manufacturing",
  "28": "Machinery",
  "29": "Automotive",
  "30": "Manufacturing",
  "3011": "Maritime",
  "3030": "Aerospace & Defense",
  "31": "Consumer Goods",
  "32": "Consumer Goods",
  "3250": "Medical Devices",
  "33": "Machinery",

  // D/E — Utilities, water, waste
  "35": "Energy & Utilities",
  "36": "Utilities",
  "37": "Environmental Services",
  "38": "Environmental Services",
  "39": "Environmental Services",

  // F — Construction
  "41": "Construction",
  "42": "Civil Engineering",
  "43": "Construction",

  // G — Trade. 45 is vehicle sales/repair, which reads as Automotive rather than Retail.
  "45": "Automotive",
  "46": "Wholesale",
  "47": "Retail",

  // H — Transport & storage
  "49": "Transportation",
  "50": "Maritime",
  "51": "Airlines & Aviation",
  "52": "Logistics & Supply Chain",
  "5210": "Warehousing",
  "53": "Logistics & Supply Chain",

  // I — Hospitality
  "55": "Hospitality",
  "56": "Restaurants",

  // J — Information & communication
  "58": "Media Production",
  "5821": "Computer Software",
  "5829": "Computer Software",
  "59": "Media Production",
  "60": "Broadcast Media",
  "61": "Telecommunications",
  "62": "Information Technology & Services",
  "6201": "Computer Software",
  "63": "Information Technology & Services",
  "6311": "Data & Analytics",

  // K — Finance & insurance
  "64": "Banking",
  "6430": "Investment Management",
  "6499": "Financial Services",
  "65": "Insurance",
  "66": "Financial Services",
  "6630": "Investment Management",

  // L — Real estate
  "68": "Real Estate",

  // M — Professional, scientific, technical. 69 must split: legal and accounting are separate
  // industries in the picker.
  "6910": "Legal Services",
  "6920": "Accounting",
  "70": "Management Consulting",
  "7021": "Public Relations",
  "71": "Architecture & Planning",
  "7112": "Civil Engineering",
  "72": "Research",
  "7211": "Biotechnology",
  "73": "Advertising & Marketing",
  "7320": "Market Research",
  "74": "Design",
  "7410": "Graphic Design",
  "75": "Veterinary",

  // N — Administrative & support
  "77": "Business Consulting",
  "78": "Staffing & Recruiting",
  "79": "Leisure & Travel",
  "80": "Security & Investigations",
  "81": "Facilities Services",
  "82": "Outsourcing/Offshoring",
  "8230": "Events Services",

  // O/P/Q — Public administration, education, health
  "84": "Government Administration",
  "85": "Education",
  "8542": "Higher Education",
  "86": "Hospital & Health Care",
  "87": "Health & Wellness",
  "88": "Health & Wellness",

  // R/S — Arts, recreation, other services
  "90": "Entertainment",
  "91": "Entertainment",
  "92": "Entertainment",
  "93": "Sports",
  "9313": "Health & Wellness",
  "94": "Nonprofit",
  "95": "Facilities Services",
  "96": "Health & Wellness",
};

// A CAEN code is only recognised at the very start of the value: "7911 - Activitati..." or a
// bare "7911". Matching digits anywhere would rewrite legitimate free text that merely contains
// a number.
const LEADING_CAEN = /^\s*(\d{4})(?!\d)/;

// Returns the mapped industry for a leading CAEN code, or the input unchanged when there isn't
// one — including codes whose division isn't in the table, so an unmapped activity keeps its
// original text instead of turning into null.
export function caenToIndustry(raw: string | null | undefined): string | null | undefined {
  const code = raw?.match(LEADING_CAEN)?.[1];
  if (!code) return raw;
  return CAEN_TO_INDUSTRY[code] ?? CAEN_TO_INDUSTRY[code.slice(0, 3)] ?? CAEN_TO_INDUSTRY[code.slice(0, 2)] ?? raw;
}
