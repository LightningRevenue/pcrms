// Curated pickers for the Company firmographic filters in Lead Intelligence.
//
// These are starting points, not enums: the DB columns are plain strings, and
// listProspectFilterOptions() unions these lists with whatever distinct values actually exist
// in the workspace. A CSV that imports "Aerospace & Defense" stays filterable even though it
// isn't listed here — the curated entries just guarantee a sensible picker before any data
// has been filled in.

// ~70 B2B industries (condensed LinkedIn taxonomy). Long enough to cover realistic B2B leads,
// short enough to stay navigable in a dropdown without type-ahead.
export const INDUSTRIES = [
  "Accounting",
  "Advertising & Marketing",
  "Aerospace & Defense",
  "Agriculture",
  "Airlines & Aviation",
  "Apparel & Fashion",
  "Architecture & Planning",
  "Automotive",
  "Banking",
  "Biotechnology",
  "Broadcast Media",
  "Building Materials",
  "Business Consulting",
  "Chemicals",
  "Civil Engineering",
  "Computer Hardware",
  "Computer Software",
  "Construction",
  "Consumer Electronics",
  "Consumer Goods",
  "Cybersecurity",
  "Data & Analytics",
  "Design",
  "E-Learning",
  "Education",
  "Electrical & Electronic Manufacturing",
  "Energy & Utilities",
  "Entertainment",
  "Environmental Services",
  "Events Services",
  "Facilities Services",
  "Financial Services",
  "Fintech",
  "Food & Beverages",
  "Government Administration",
  "Graphic Design",
  "Health & Wellness",
  "Higher Education",
  "Hospital & Health Care",
  "Hospitality",
  "Human Resources",
  "Import & Export",
  "Industrial Automation",
  "Information Technology & Services",
  "Insurance",
  "Internet",
  "Investment Management",
  "Legal Services",
  "Leisure & Travel",
  "Logistics & Supply Chain",
  "Machinery",
  "Management Consulting",
  "Manufacturing",
  "Maritime",
  "Market Research",
  "Mechanical Engineering",
  "Media Production",
  "Medical Devices",
  "Mining & Metals",
  "Nonprofit",
  "Oil & Energy",
  "Outsourcing/Offshoring",
  "Packaging & Containers",
  "Pharmaceuticals",
  "Printing",
  "Professional Training",
  "Public Relations",
  "Real Estate",
  "Renewables & Environment",
  "Research",
  "Restaurants",
  "Retail",
  "SaaS",
  "Security & Investigations",
  "Semiconductors",
  "Shipping",
  "Sports",
  "Staffing & Recruiting",
  "Telecommunications",
  "Textiles",
  "Transportation",
  "Utilities",
  "Venture Capital & Private Equity",
  "Veterinary",
  "Warehousing",
  "Wholesale",
] as const;

// Ordered smallest-to-largest, not alphabetically — the picker renders them in this order.
export const REVENUE_RANGES = [
  "<$1M",
  "$1M-$5M",
  "$5M-$10M",
  "$10M-$50M",
  "$50M-$100M",
  "$100M-$500M",
  "$500M-$1B",
  "$1B+",
] as const;
export type RevenueRange = (typeof REVENUE_RANGES)[number];

// Upper bound (exclusive) for each bucket, in units. The last one is open-ended.
const REVENUE_BOUNDS: [RevenueRange, number][] = [
  ["<$1M", 1_000_000],
  ["$1M-$5M", 5_000_000],
  ["$5M-$10M", 10_000_000],
  ["$10M-$50M", 50_000_000],
  ["$50M-$100M", 100_000_000],
  ["$100M-$500M", 500_000_000],
  ["$500M-$1B", 1_000_000_000],
];

// Parses the free-text annualRevenue people actually type — "$2.5M", "5000000", "1,200,000",
// "€3M", "1.2b", "750k" — into a number. Returns null when there's no usable figure, so a
// range is only ever derived from something we genuinely understood.
export function parseRevenueAmount(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;

  const text = raw.trim().toLowerCase().replace(/[$€£,\s]/g, "");
  // A range like "1m-5m" is already bucketed input; take the lower bound as the figure.
  const first = text.split(/[-–—]/)[0];

  const match = first.match(/^(\d+(?:\.\d+)?)([kmb])?$/);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;

  const suffix = match[2];
  const multiplier = suffix === "b" ? 1_000_000_000 : suffix === "m" ? 1_000_000 : suffix === "k" ? 1_000 : 1;
  return value * multiplier;
}

// Maps a parsed amount onto one of REVENUE_RANGES. Kept separate from parsing so the bucket
// list can change without touching the parser.
export function revenueRangeFor(amount: number | null): RevenueRange | null {
  if (amount === null || !Number.isFinite(amount) || amount < 0) return null;
  for (const [range, upperExclusive] of REVENUE_BOUNDS) {
    if (amount < upperExclusive) return range;
  }
  return "$1B+";
}

// Convenience: free text straight to a bucket. Null when the text wasn't parseable, which is
// the signal to leave whatever the user picked manually alone.
export function deriveRevenueRange(annualRevenue: string | null | undefined): RevenueRange | null {
  return revenueRangeFor(parseRevenueAmount(annualRevenue));
}

// Employee-count buckets. Stored as an Int on Company; these are the filter presets, each
// mapping to a gte/lte pair rather than a stored label.
export const EMPLOYEE_BUCKETS: { id: string; label: string; min?: number; max?: number }[] = [
  { id: "1-10", label: "1-10", min: 1, max: 10 },
  { id: "11-50", label: "11-50", min: 11, max: 50 },
  { id: "51-200", label: "51-200", min: 51, max: 200 },
  { id: "201-500", label: "201-500", min: 201, max: 500 },
  { id: "501-1000", label: "501-1,000", min: 501, max: 1000 },
  { id: "1001-5000", label: "1,001-5,000", min: 1001, max: 5000 },
  { id: "5001-10000", label: "5,001-10,000", min: 5001, max: 10000 },
  { id: "10001+", label: "10,001+", min: 10001 },
];

// The bucket an exact headcount falls into, for showing a stored Int in a bucket picker.
export function employeeBucketLabel(count: number | null | undefined): string {
  if (count == null) return "";
  const bucket = EMPLOYEE_BUCKETS.find((b) => count >= (b.min ?? 0) && (b.max == null || count <= b.max));
  return bucket?.label ?? "";
}

// Turns a bucket label back into a storable number. Picking a range can't recover an exact
// headcount, so the bucket's lower bound is stored — which is what the filters compare against
// anyway. A plain number (from CSV or the API) is passed straight through by the caller.
export function employeeCountFromBucketLabel(label: string): number | null {
  const bucket = EMPLOYEE_BUCKETS.find((b) => b.label === label);
  return bucket?.min ?? null;
}

// Single entry point for turning user/CSV/API input into a storable headcount. Accepts a
// bucket label ("201-500"), a plain number, or a number with separators; anything else is
// null rather than a silent 0. Used by create, import, and the API so all agree.
export function parseEmployeeCountInput(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  const fromBucket = employeeCountFromBucketLabel(trimmed);
  if (fromBucket !== null) return fromBucket;

  const parsed = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
}

// Appends a stored value that isn't in the curated list, so imported data stays visible and
// selectable instead of silently disappearing from a picker.
export function withCurrent(curated: readonly string[], current: string | null | undefined): string[] {
  if (!current?.trim() || curated.includes(current)) return [...curated];
  return [...curated, current];
}

// ISO 3166-1 country names. Fixed list — unlike industry, this one doesn't drift.
export const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia",
  "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei",
  "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde",
  "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo",
  "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica",
  "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea",
  "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia",
  "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jordan", "Kazakhstan",
  "Kenya", "Kiribati", "Kosovo", "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho",
  "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Macau", "Madagascar", "Malawi",
  "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius",
  "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique",
  "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger",
  "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine",
  "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar",
  "Romania", "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia",
  "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe",
  "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia",
  "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain",
  "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan",
  "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia",
  "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates",
  "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City",
  "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
] as const;
