import { toCsv } from "@/lib/csv";
import { STANDARD_IMPORT_FIELDS, withRequiredFields, type ImportableObjectType } from "@/lib/import-fields";

// Keyed by field key, not positional — the columns are generated from STANDARD_IMPORT_FIELDS, so
// a reordered or newly added field can't silently shift the sample values into the wrong column.
const EXAMPLE_VALUES: Record<ImportableObjectType, Record<string, string>[]> = {
  company: [
    {
      name: "Acme Inc",
      domain: "acme.com",
      address: "123 Main St, Austin, TX",
      linkedin: "linkedin.com/company/acme",
      annualRevenue: "$5M",
      industry: "Computer Software",
      country: "United States",
      revenueRange: "$1M-$10M",
      employeeCount: "120",
    },
    {
      name: "Globex Corp",
      domain: "globex.com",
      linkedin: "linkedin.com/company/globex",
      industry: "Manufacturing",
      country: "Germany",
      employeeCount: "2500",
    },
  ],
  person: [
    {
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@acme.com",
      phone: "+1 555 0100",
      jobTitle: "Head of Sales",
      linkedin: "linkedin.com/in/janedoe",
      company: "Acme Inc",
      industry: "Computer Software",
      country: "United States",
      employeeCount: "120",
      annualRevenue: "$5M",
    },
    {
      firstName: "John",
      lastName: "Smith",
      email: "john@globex.com",
      jobTitle: "CTO",
      company: "Globex Corp",
      industry: "Manufacturing",
      country: "Germany",
      employeeCount: "2500",
      annualRevenue: "$80M",
    },
  ],
};

// requiredKeys comes from the workspace's config, so the sample file matches what the import
// will actually accept: required columns are marked in the header and always carry a value in
// every sample row, optional ones can be blank.
export function exampleCsv(objectType: ImportableObjectType, requiredKeys: string[] = []): string {
  const fields = withRequiredFields(STANDARD_IMPORT_FIELDS[objectType], requiredKeys);
  const headers = fields.map((f) => (f.required ? `${f.label} (required)` : f.label));
  const rows = EXAMPLE_VALUES[objectType].map((values) =>
    fields.map((f) => values[f.key] ?? (f.required ? placeholderFor(f.key) : ""))
  );
  return toCsv([headers, ...rows]);
}

// A required column must never be blank in the sample, or the file we hand out fails its own
// import. Only hit when a field has no curated sample value above.
function placeholderFor(key: string) {
  return `<${key}>`;
}
