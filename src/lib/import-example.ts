import { toCsv } from "@/lib/csv";
import { STANDARD_IMPORT_FIELDS } from "@/lib/import-fields";
import type { ObjectType } from "@/lib/actions/custom-fields";

const EXAMPLE_ROWS: Record<ObjectType, string[][]> = {
  company: [
    ["Acme Inc", "acme.com", "123 Main St, Austin, TX", "linkedin.com/company/acme", "$5M"],
    ["Globex Corp", "globex.com", "", "linkedin.com/company/globex", ""],
  ],
  person: [
    ["Jane", "Doe", "jane@acme.com", "+1 555 0100", "Acme Inc", "Head of Sales", "linkedin.com/in/janedoe"],
    ["John", "Smith", "john@globex.com", "", "Globex Corp", "", ""],
  ],
};

export function exampleCsv(objectType: ObjectType): string {
  const headers = STANDARD_IMPORT_FIELDS[objectType].map((f) => f.label);
  return toCsv([headers, ...EXAMPLE_ROWS[objectType]]);
}
