// Derives seniority + department from the free-text jobTitle so Lead Intelligence can offer
// them as pickable filters. jobTitle stays the source of truth and is never rewritten — these
// are additive, best-effort labels, null when nothing matches (a null seniority just means
// "not classified", never "individual contributor").
//
// ponytail: ordered keyword scan, not an NLP model. The order matters — "VP of Engineering"
// must hit "vp" before "engineering"-department logic, and "Head of Sales" must not match the
// "head" in "headcount". Swap in a real classifier only if match rates prove bad in practice.

export const SENIORITIES = [
  "owner",
  "c_level",
  "vp",
  "director",
  "head",
  "manager",
  "senior",
  "entry",
] as const;
export type Seniority = (typeof SENIORITIES)[number];

export const SENIORITY_LABELS: Record<Seniority, string> = {
  owner: "Owner / Founder",
  c_level: "C-Level",
  vp: "VP",
  director: "Director",
  head: "Head of",
  manager: "Manager",
  senior: "Senior",
  entry: "Individual Contributor",
};

export const DEPARTMENTS = [
  "executive",
  "sales",
  "marketing",
  "engineering",
  "product",
  "finance",
  "hr",
  "operations",
  "legal",
  "support",
  "it",
] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABELS: Record<Department, string> = {
  executive: "Executive",
  sales: "Sales",
  marketing: "Marketing",
  engineering: "Engineering",
  product: "Product",
  finance: "Finance",
  hr: "HR / People",
  operations: "Operations",
  legal: "Legal",
  support: "Customer Support",
  it: "IT",
};

// Matched top-down: the first hit wins, so the most senior/specific patterns come first.
const SENIORITY_PATTERNS: [Seniority, RegExp][] = [
  ["owner", /\b(owner|founder|co[\s-]?founder|proprietor|partner)\b/],
  // Spelled-out C-titles plus the C_O initialisms (CEO/CTO/CFO/CMO/COO/CIO/CRO/CPO/CISO...).
  // "president" must not fire on "Vice President"/"SVP" — those are the vp rung, so the
  // preceding word is excluded rather than the following one.
  ["c_level", /\b(c[a-z]{1,3}o|chief|cxo)\b|(?<!vice[\s-])(?<!deputy\s)\bpresident\b/],
  ["vp", /\b(vp|svp|evp|avp|vice[\s-]?president)\b/],
  ["director", /\b(director|dir\.?)\b/],
  ["head", /\bhead\s+of\b|\bglobal\s+head\b|\bhead,\s/],
  ["manager", /\b(manager|mgr\.?|supervisor|lead|team\s+lead)\b/],
  ["senior", /\b(senior|sr\.?|principal|staff)\b/],
];

const DEPARTMENT_PATTERNS: [Department, RegExp][] = [
  ["sales", /\b(sales|account\s+executive|business\s+development|bdr\b|sdr\b|revenue|crm\b)/],
  ["marketing", /\b(marketing|growth|brand|content|seo\b|demand\s+gen|communication|\bpr\b)/],
  // Stems are left open-ended (no trailing \b) so "financ" matches "finance"/"financial";
  // a trailing \b would require a non-word char right after the stem and never fire.
  ["engineering", /\b(engineer|developer|dev\b|software|architect|devops|sre\b|qa\b|data\s+scien|machine\s+learning)/],
  ["product", /\b(product|ux\b|ui\b|design)/],
  ["finance", /\b(financ|account(ant|ing)|controller|treasur|audit|bookkeep)/],
  ["hr", /\b(hr\b|human\s+resources|people\b|talent|recruit|hiring)/],
  ["legal", /\b(legal|counsel|attorney|lawyer|complian|paralegal)/],
  ["support", /\b(support|customer\s+success|customer\s+service|help\s?desk)/],
  ["it", /\b(it\b|information\s+technology|sysadmin|system\s+admin|network|security|infosec)/],
  ["operations", /\b(operations|ops\b|logistic|supply\s+chain|procurement|facilities)/],
];

// C-suite titles carry their own department signal ("CTO" is engineering, "CFO" is finance);
// checked before the generic patterns so "CFO" doesn't fall through to a bare "executive".
const C_LEVEL_DEPARTMENTS: [Department, RegExp][] = [
  ["engineering", /\b(cto|ciso)\b/],
  ["finance", /\bcfo\b/],
  ["marketing", /\bcmo\b/],
  ["sales", /\bcro\b/],
  ["product", /\bcpo\b/],
  ["it", /\bcio\b/],
  ["operations", /\bcoo\b/],
];

function normalize(jobTitle: string) {
  return jobTitle.toLowerCase().replace(/[^a-z0-9\s,.-]/g, " ");
}

export function deriveSeniority(jobTitle: string | null | undefined): Seniority | null {
  if (!jobTitle?.trim()) return null;
  const text = normalize(jobTitle);

  for (const [seniority, pattern] of SENIORITY_PATTERNS) {
    if (pattern.test(text)) return seniority;
  }
  // A title that classifies into a department but matched no rank is an IC ("Software
  // Engineer"). A title matching nothing at all stays null rather than guessing.
  return deriveDepartment(jobTitle) ? "entry" : null;
}

export function deriveDepartment(jobTitle: string | null | undefined): Department | null {
  if (!jobTitle?.trim()) return null;
  const text = normalize(jobTitle);

  for (const [department, pattern] of C_LEVEL_DEPARTMENTS) {
    if (pattern.test(text)) return department;
  }
  for (const [department, pattern] of DEPARTMENT_PATTERNS) {
    if (pattern.test(text)) return department;
  }
  // CEO/President/Founder run the company rather than a function.
  if (/\b(ceo|chief\s+executive|president|founder|co[\s-]?founder|owner|managing\s+director)\b/.test(text)) {
    return "executive";
  }
  return null;
}

export function deriveJobTitleFields(jobTitle: string | null | undefined) {
  return { seniority: deriveSeniority(jobTitle), department: deriveDepartment(jobTitle) };
}
