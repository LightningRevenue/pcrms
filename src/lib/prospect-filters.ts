// Shared between the Lead Intelligence server action and its client view. Lives outside
// actions/prospect-search.ts because a "use server" file may only export async functions —
// same split as inbox-filters.ts.

export const PROSPECT_PAGE_SIZE = 50;

// How "re-engageable" a contact is, relative to campaigns/sequences they've been in. These
// are the three retargeting angles the picker offers; they're mutually independent, so
// selecting several means OR (a contact matching any of them qualifies).
export const ENGAGEMENT_FILTERS = ["touched_no_reply", "cold", "never_contacted"] as const;
export type EngagementFilter = (typeof ENGAGEMENT_FILTERS)[number];

export const ENGAGEMENT_LABELS: Record<EngagementFilter, string> = {
  touched_no_reply: "Touched, never replied",
  cold: "No activity recently",
  never_contacted: "Never contacted",
};

export const ENGAGEMENT_HINTS: Record<EngagementFilter, string> = {
  touched_no_reply: "In a campaign, but never replied",
  cold: "No logged activity in the chosen window",
  never_contacted: "Never added to any campaign",
};

// Window for the "cold" filter, in days.
export const COLD_DAY_OPTIONS = [30, 60, 90, 180, 365] as const;

export type CustomFieldFilter = {
  definitionId: string;
  /** Empty `values` with mode "set"/"unset" checks presence instead of matching a value. */
  mode: "in" | "set" | "unset";
  values: string[];
};

export type ProspectFilters = {
  q?: string;
  // Person-level
  seniority?: string[];
  department?: string[];
  stage?: string[];
  ownerIds?: string[];
  /** "owned" / "unowned" are handled via ownerIds; this covers the no-owner case explicitly. */
  noOwner?: boolean;
  verified?: string[];
  /** Contacts who have unsubscribed are excluded by default — outreach can't reach them. */
  includeUnsubscribed?: boolean;
  /** Only contacts that have an email address at all. */
  hasEmail?: boolean;
  /** Only contacts with a phone number — the gate for building a call list. */
  hasPhone?: boolean;
  // Company-level
  industry?: string[];
  country?: string[];
  revenueRange?: string[];
  employeeBuckets?: string[];
  /** Minimum number of contacts this CRM holds at the person's company. */
  minContactsAtCompany?: number;
  // Provenance
  importBatchIds?: string[];
  campaignIds?: string[];
  // Retargeting
  engagement?: EngagementFilter[];
  coldDays?: number;
  // Custom fields
  customFields?: CustomFieldFilter[];
  page?: number;
};

export function hasAnyFilter(f: ProspectFilters) {
  return Boolean(
    f.q ||
      f.seniority?.length ||
      f.department?.length ||
      f.stage?.length ||
      f.ownerIds?.length ||
      f.noOwner ||
      f.verified?.length ||
      f.hasEmail ||
      f.hasPhone ||
      f.industry?.length ||
      f.country?.length ||
      f.revenueRange?.length ||
      f.employeeBuckets?.length ||
      f.minContactsAtCompany ||
      f.importBatchIds?.length ||
      f.campaignIds?.length ||
      f.engagement?.length ||
      f.customFields?.length
  );
}
