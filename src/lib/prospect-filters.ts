// Shared between the Lead Intelligence server action and its client view. Lives outside
// actions/prospect-search.ts because a "use server" file may only export async functions —
// same split as inbox-filters.ts.

import { EMPLOYEE_BUCKETS } from "@/lib/firmographics";

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

// --- Saved views: comparison ---------------------------------------------------------------
// Two filter sets are "the same view" when they'd select the same people. Everything that
// doesn't change the result — key order, [] vs undefined, false vs undefined, the order of
// values inside a multi-select, and `page` — is normalized away so the Contacts save bar
// doesn't claim unsaved changes after a no-op edit (select a value, deselect it).

const sorted = (v?: string[]) => (v?.length ? [...v].sort() : undefined);

export function normalizeProspectFilters(f: ProspectFilters): ProspectFilters {
  const n: ProspectFilters = {};
  if (f.q?.trim()) n.q = f.q.trim();
  if (f.seniority?.length) n.seniority = sorted(f.seniority);
  if (f.department?.length) n.department = sorted(f.department);
  if (f.stage?.length) n.stage = sorted(f.stage);
  if (f.ownerIds?.length) n.ownerIds = sorted(f.ownerIds);
  if (f.noOwner) n.noOwner = true;
  if (f.verified?.length) n.verified = sorted(f.verified);
  if (f.includeUnsubscribed) n.includeUnsubscribed = true;
  if (f.hasEmail) n.hasEmail = true;
  if (f.hasPhone) n.hasPhone = true;
  if (f.industry?.length) n.industry = sorted(f.industry);
  if (f.country?.length) n.country = sorted(f.country);
  if (f.revenueRange?.length) n.revenueRange = sorted(f.revenueRange);
  if (f.employeeBuckets?.length) n.employeeBuckets = sorted(f.employeeBuckets);
  if (f.minContactsAtCompany && f.minContactsAtCompany > 1) n.minContactsAtCompany = f.minContactsAtCompany;
  if (f.importBatchIds?.length) n.importBatchIds = sorted(f.importBatchIds);
  if (f.campaignIds?.length) n.campaignIds = sorted(f.campaignIds);
  if (f.engagement?.length) n.engagement = [...f.engagement].sort();
  // coldDays only affects the result when the "cold" angle is selected.
  if (f.engagement?.includes("cold") && f.coldDays) n.coldDays = f.coldDays;
  if (f.customFields?.length) {
    n.customFields = f.customFields
      .map((cf) => ({ definitionId: cf.definitionId, mode: cf.mode, values: [...cf.values].sort() }))
      .sort((a, b) => a.definitionId.localeCompare(b.definitionId));
  }
  return n;
}

export function prospectFiltersEqual(a: ProspectFilters, b: ProspectFilters): boolean {
  // normalize builds both objects with the same literal key order, so stringify is a safe
  // deep-compare here without pulling in a deep-equal dependency.
  return JSON.stringify(normalizeProspectFilters(a)) === JSON.stringify(normalizeProspectFilters(b));
}

// --- In-memory matching ----------------------------------------------------------------------
// Contacts loads every person and filters client-side (kanban and sort need the whole set),
// so it can't reuse buildProspectWhere's Prisma output. This mirrors that function clause for
// clause over an already-loaded row; the two must stay in step — prospect-filters.test.ts and
// prospect-where.test.ts pin the shared semantics.

/** Shape the matcher needs, kept structural so it isn't tied to one Prisma select. */
export type MatchablePerson = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  seniority: string | null;
  department: string | null;
  stage: string | null;
  ownerId: string | null;
  createdAt: Date;
  unsubscribedAt: Date | null;
  emailVerifiedStatus: string | null;
  importBatchId: string | null;
  companyId: string | null;
  companyName: string | null;
  industry: string | null;
  country: string | null;
  revenueRange: string | null;
  employeeCount: number | null;
  campaignIds: string[];
  /** True when any campaign membership has a reply recorded. */
  hasCampaignReply: boolean;
  /** Newest non-"created" activity, or null when there is none. */
  lastActivityAt: Date | null;
  /** definitionId → stored value, for custom-field filters. */
  customValues: Record<string, string | null>;
  /** Contacts this CRM holds at the same company, for minContactsAtCompany. */
  contactsAtCompany: number;
};

const filled = (v: string | null) => v != null && v !== "";

export function matchesProspectFilters(p: MatchablePerson, f: ProspectFilters, coldBefore?: Date): boolean {
  if (f.q?.trim()) {
    const q = f.q.trim().toLowerCase();
    const hit = [p.firstName, p.lastName, p.email, p.jobTitle, p.companyName].some((v) =>
      v?.toLowerCase().includes(q)
    );
    if (!hit) return false;
  }

  if (f.seniority?.length && !(p.seniority && f.seniority.includes(p.seniority))) return false;
  if (f.department?.length && !(p.department && f.department.includes(p.department))) return false;
  if (f.stage?.length && !(p.stage && f.stage.includes(p.stage))) return false;
  if (f.verified?.length && !(p.emailVerifiedStatus && f.verified.includes(p.emailVerifiedStatus))) return false;
  if (f.hasEmail && !filled(p.email)) return false;
  if (f.hasPhone && !filled(p.phone)) return false;

  if (f.ownerIds?.length || f.noOwner) {
    const byId = f.ownerIds?.length ? p.ownerId != null && f.ownerIds.includes(p.ownerId) : false;
    const byNone = f.noOwner ? p.ownerId == null : false;
    if (!byId && !byNone) return false;
  }

  if (!f.includeUnsubscribed && p.unsubscribedAt != null) return false;

  if (f.importBatchIds?.length && !(p.importBatchId && f.importBatchIds.includes(p.importBatchId))) return false;
  if (f.campaignIds?.length && !p.campaignIds.some((id) => f.campaignIds!.includes(id))) return false;

  if (f.industry?.length && !(p.industry && f.industry.includes(p.industry))) return false;
  if (f.country?.length && !(p.country && f.country.includes(p.country))) return false;
  if (f.revenueRange?.length && !(p.revenueRange && f.revenueRange.includes(p.revenueRange))) return false;

  if (f.employeeBuckets?.length) {
    const n = p.employeeCount;
    const inBucket =
      n != null &&
      f.employeeBuckets.some((id) => {
        const b = EMPLOYEE_BUCKETS.find((x) => x.id === id);
        if (!b) return false;
        return (b.min == null || n >= b.min) && (b.max == null || n <= b.max);
      });
    if (!inBucket) return false;
  }

  if (f.minContactsAtCompany && f.minContactsAtCompany > 1) {
    if (p.companyId == null || p.contactsAtCompany < f.minContactsAtCompany) return false;
  }

  if (f.engagement?.length) {
    const cutoff = coldBefore ?? coldCutoffDate(f.coldDays);
    const any = f.engagement.some((angle) => {
      if (angle === "touched_no_reply") return p.campaignIds.length > 0 && !p.hasCampaignReply;
      if (angle === "never_contacted") return p.campaignIds.length === 0;
      // "cold": no activity since the cutoff, and old enough to have gone quiet.
      return (p.lastActivityAt == null || p.lastActivityAt < cutoff) && p.createdAt < cutoff;
    });
    if (!any) return false;
  }

  if (f.customFields?.length) {
    for (const cf of f.customFields) {
      const value = p.customValues[cf.definitionId] ?? null;
      if (cf.mode === "set" && !filled(value)) return false;
      if (cf.mode === "unset" && filled(value)) return false;
      if (cf.mode === "in" && !(value != null && cf.values.includes(value))) return false;
    }
  }

  return true;
}

/** Same cutoff rule coldCutoff() in prospect-search.ts uses, so both paths agree on "cold". */
export function coldCutoffDate(coldDays?: number, now = new Date()): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - (coldDays ?? 90));
  return d;
}

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
