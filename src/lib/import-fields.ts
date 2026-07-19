import type { ObjectType } from "@/lib/actions/custom-fields";

export type ImportField = {
  key: string;
  label: string;
  required?: boolean;
  isCustom?: boolean;
};

export const STANDARD_IMPORT_FIELDS: Record<ObjectType, ImportField[]> = {
  company: [
    { key: "name", label: "Name", required: true },
    { key: "domain", label: "Domain Name" },
    { key: "address", label: "Address" },
    { key: "linkedin", label: "Linkedin" },
    { key: "annualRevenue", label: "Annual Revenue" },
  ],
  person: [
    { key: "firstName", label: "First name", required: true },
    { key: "lastName", label: "Last name" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "jobTitle", label: "Job Title" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "company", label: "Company" },
  ],
};

const NORMALIZE = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

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
