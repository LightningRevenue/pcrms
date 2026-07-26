export const PERSON_FIELD_LABELS = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  phone: "Phone",
  jobTitle: "Job Title",
  linkedin: "LinkedIn",
  company: "Company",
} as const;

// Only string-valued Company columns belong here — updateCompanyField writes the raw trimmed
// string straight through, so a numeric column (employeeCount) would be written as text.
// It's edited via its own typed path instead.
export const COMPANY_FIELD_LABELS = {
  name: "Name",
  domain: "Domain Name",
  address: "Address",
  linkedin: "Linkedin",
  annualRevenue: "Annual Revenue",
  industry: "Industry",
  country: "Country",
  revenueRange: "Revenue Range",
} as const;
