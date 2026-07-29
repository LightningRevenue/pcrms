import type { ObjectType } from "@/lib/actions/custom-fields";

export type ImportField = {
  key: string;
  label: string;
  required?: boolean;
  isCustom?: boolean;
};

// CSV import covers companies and people only — deals are created from a contact or the
// pipeline board, never bulk-loaded. Narrower than ObjectType on purpose.
export type ImportableObjectType = Exclude<ObjectType, "opportunity">;

export const STANDARD_IMPORT_FIELDS: Record<ImportableObjectType, ImportField[]> = {
  company: [
    { key: "name", label: "Name", required: true },
    { key: "domain", label: "Domain Name" },
    { key: "address", label: "Address" },
    { key: "linkedin", label: "Linkedin" },
    { key: "annualRevenue", label: "Annual Revenue" },
    { key: "industry", label: "Industry" },
    { key: "country", label: "Country" },
    { key: "revenueRange", label: "Revenue Range" },
    { key: "employeeCount", label: "Employee Count" },
  ],
  person: [
    { key: "firstName", label: "First name", required: true },
    { key: "lastName", label: "Last name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "jobTitle", label: "Job Title" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "company", label: "Company" },
    // Firmographic columns land on the Person's company, not the Person — importPersonRow
    // forwards them to the company it resolves for the row.
    { key: "industry", label: "Industry" },
    { key: "country", label: "Country" },
    { key: "employeeCount", label: "Employee Count" },
    { key: "annualRevenue", label: "Annual Revenue" },
  ],
};

// Overlays the workspace's required-field config onto the static list, so the mapping screen and
// the example CSV both reflect what's actually enforced. firstName keeps its built-in required
// flag either way.
export function withRequiredFields(fields: ImportField[], requiredKeys: string[]): ImportField[] {
  return fields.map((f) => (requiredKeys.includes(f.key) ? { ...f, required: true } : f));
}

// The "(required)" suffix is stripped before normalizing so the example CSV we hand out — whose
// headers carry that marker — still auto-maps when the user fills it in and uploads it back.
const NORMALIZE = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(required\)/g, "")
    .replace(/[^a-z0-9]/g, "");

// ponytail: exact/substring match on normalized header vs. field label/key. Add fuzzy matching if headers are messier in practice.
export function guessMapping(headers: string[], fields: ImportField[]): Record<string, string | null> {
  const mapping: Record<string, string | null> = {};
  const used = new Set<string>();

  for (const header of headers) {
    const normalizedHeader = NORMALIZE(header);
    const match = fields.find(
      (f) => !used.has(f.key) && (NORMALIZE(f.label) === normalizedHeader || NORMALIZE(f.key) === normalizedHeader)
    );
    if (match) {
      mapping[header] = match.key;
      used.add(match.key);
    } else {
      mapping[header] = null;
    }
  }

  return mapping;
}
