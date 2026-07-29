// Field whitelists + labels for bulk edit. Plain module, not "use server": a "use server"
// file may only export async functions, so these constants can't live next to the actions
// that use them (see lib/actions/bulk-fields.ts).

export const BULK_COMPANY_FIELDS = ["industry", "country", "revenueRange", "employeeCount"] as const;
export type BulkCompanyField = (typeof BULK_COMPANY_FIELDS)[number];

export const BULK_COMPANY_LABELS: Record<BulkCompanyField, string> = {
  industry: "Industry",
  country: "Country",
  revenueRange: "Revenue Range",
  employeeCount: "Employees",
};

// Person-side: stage is the one segmentation field that's directly editable. seniority and
// department are derived from jobTitle (lib/job-title.ts) and deliberately excluded — setting
// them by hand would be silently overwritten the next time the title is edited.
export const BULK_PERSON_FIELDS = ["stage"] as const;
export type BulkPersonField = (typeof BULK_PERSON_FIELDS)[number];

export const BULK_PERSON_LABELS: Record<BulkPersonField, string> = {
  stage: "Stage",
};
