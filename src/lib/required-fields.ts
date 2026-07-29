// Which fields a workspace insists on before a Person can be created — from the New Person
// panel or a CSV import. Off by default; when on, only the explicitly selected keys are
// enforced. firstName stays required regardless (createContact/importPersonRow have always
// thrown without it), so it isn't selectable here.

export type RequiredFieldDef = {
  key: string;
  label: string;
  // Firmographics live on Company, not Person — when required, they're written to the company
  // resolved at save time (created or matched by name/domain). See applyCompanyRequiredFields.
  on: "person" | "company";
};

export const REQUIRABLE_PERSON_FIELDS: RequiredFieldDef[] = [
  { key: "lastName", label: "Last name", on: "person" },
  { key: "email", label: "Email", on: "person" },
  { key: "phone", label: "Phone", on: "person" },
  { key: "jobTitle", label: "Job Title", on: "person" },
  { key: "linkedin", label: "LinkedIn", on: "person" },
  { key: "company", label: "Company", on: "person" },
  { key: "industry", label: "Industry", on: "company" },
  { key: "country", label: "Country", on: "company" },
  { key: "employeeCount", label: "Employee Count", on: "company" },
  { key: "annualRevenue", label: "Annual Revenue", on: "company" },
];

const BY_KEY = new Map(REQUIRABLE_PERSON_FIELDS.map((f) => [f.key, f]));

export type RequiredFieldsConfig = { enforced: boolean; keys: string[] };

export const REQUIRED_FIELDS_OFF: RequiredFieldsConfig = { enforced: false, keys: [] };

// Stored as one JSON string in WorkspaceSetting rather than its own table — it's a single
// small config row per workspace, same shape as the other settings there.
export function parseRequiredFields(raw: string | null): RequiredFieldsConfig {
  if (!raw) return REQUIRED_FIELDS_OFF;
  try {
    const parsed = JSON.parse(raw) as Partial<RequiredFieldsConfig>;
    if (!parsed || typeof parsed !== "object") return REQUIRED_FIELDS_OFF;
    // Unknown keys are dropped: a field could have been removed from REQUIRABLE_PERSON_FIELDS
    // since the config was saved, and enforcing a key nothing can ever fill would make the
    // form permanently unsubmittable.
    const keys = Array.isArray(parsed.keys) ? parsed.keys.filter((k) => BY_KEY.has(k)) : [];
    return { enforced: parsed.enforced === true, keys };
  } catch {
    return REQUIRED_FIELDS_OFF;
  }
}

export function serializeRequiredFields(config: RequiredFieldsConfig): string {
  return JSON.stringify({
    enforced: config.enforced,
    keys: config.keys.filter((k) => BY_KEY.has(k)),
  });
}

// The active list, already resolved against the enforce toggle — empty when enforcement is off,
// so callers never need to check both.
export function activeRequiredFields(config: RequiredFieldsConfig): RequiredFieldDef[] {
  if (!config.enforced) return [];
  return REQUIRABLE_PERSON_FIELDS.filter((f) => config.keys.includes(f.key));
}

// Single validator behind the New Person panel, createContact and the CSV import, so all three
// agree on what counts as "filled" (whitespace-only is not). Returns the labels of what's
// missing; empty means the record passes.
export function missingRequiredFields(
  values: Record<string, string | null | undefined>,
  config: RequiredFieldsConfig
): string[] {
  return activeRequiredFields(config)
    .filter((f) => !values[f.key]?.trim())
    .map((f) => f.label);
}

export function requiredFieldsError(missing: string[]): string {
  return `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} required`;
}
