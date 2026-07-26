import type { Prisma } from "@prisma/client";
import type { ProspectFilters } from "@/lib/prospect-filters";
import { EMPLOYEE_BUCKETS } from "@/lib/firmographics";

// Pure Prisma `where` builder for Lead Intelligence, split out from the server action so it
// can be unit-tested without a database. Every filter is AND-ed; multi-select values inside a
// single filter are OR-ed (`in`), which is what a picker implies.
//
// Callers MUST still spread workspaceId + personVisibilityFilter(ctx) around the result —
// this function deliberately knows nothing about tenancy so it can't be the thing that
// silently drops it. See searchProspects().
//
// Two filters can't be expressed as pure relation filters and are resolved to id lists by the
// action before calling in (see PreResolved): Activity is polymorphic (entityType/entityId,
// no Person relation) and CustomFieldValue.recordId is a bare string with no FK. Both arrive
// here as plain id sets so this stays a single query and a pure function.
export type PreResolved = {
  /** Person ids with an Activity newer than the cold cutoff — excluded by the "cold" angle. */
  recentlyActiveIds?: string[];
  /** Person ids matching every selected custom-field filter, when any were selected. */
  customFieldMatchIds?: string[];
  /** Company ids holding at least `minContactsAtCompany` contacts. */
  companyIdsWithEnoughContacts?: string[];
};

export function buildProspectWhere(
  f: ProspectFilters,
  opts: { coldBefore: Date; resolved?: PreResolved }
): Prisma.PersonWhereInput {
  const and: Prisma.PersonWhereInput[] = [];

  if (f.q?.trim()) {
    const q = f.q.trim();
    and.push({
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { jobTitle: { contains: q, mode: "insensitive" } },
        { company: { name: { contains: q, mode: "insensitive" } } },
      ],
    });
  }

  if (f.seniority?.length) and.push({ seniority: { in: f.seniority } });
  if (f.department?.length) and.push({ department: { in: f.department } });
  if (f.stage?.length) and.push({ stage: { in: f.stage } });
  if (f.verified?.length) and.push({ emailVerifiedStatus: { in: f.verified } });
  // Empty strings count as missing — an imported blank cell lands as "" rather than null, and
  // a contact with "" has no more of an email/phone than one with null.
  if (f.hasEmail) and.push({ email: { not: null }, NOT: { email: "" } });
  if (f.hasPhone) and.push({ phone: { not: null }, NOT: { phone: "" } });

  // Owner: explicit ids and "no owner" combine as OR, so you can ask for
  // "mine or unassigned" in one query.
  if (f.ownerIds?.length || f.noOwner) {
    const owner: Prisma.PersonWhereInput[] = [];
    if (f.ownerIds?.length) owner.push({ ownerId: { in: f.ownerIds } });
    if (f.noOwner) owner.push({ ownerId: null });
    and.push({ OR: owner });
  }

  // Unsubscribed contacts are excluded unless explicitly asked for — every send path refuses
  // them anyway (assertNotUnsubscribed), so surfacing them in a prospecting list would only
  // build audiences that silently under-deliver.
  if (!f.includeUnsubscribed) and.push({ unsubscribedAt: null });

  if (f.importBatchIds?.length) and.push({ importBatchId: { in: f.importBatchIds } });
  if (f.campaignIds?.length) and.push({ campaignMembers: { some: { campaignId: { in: f.campaignIds } } } });

  // --- Company-level (via the primary company relation) ---
  const company: Prisma.CompanyWhereInput = {};
  if (f.industry?.length) company.industry = { in: f.industry };
  if (f.country?.length) company.country = { in: f.country };
  if (f.revenueRange?.length) company.revenueRange = { in: f.revenueRange };

  if (f.employeeBuckets?.length) {
    const ranges = f.employeeBuckets
      .map((id) => EMPLOYEE_BUCKETS.find((b) => b.id === id))
      .filter((b): b is (typeof EMPLOYEE_BUCKETS)[number] => !!b)
      .map((b) => ({
        employeeCount: {
          ...(b.min != null ? { gte: b.min } : {}),
          ...(b.max != null ? { lte: b.max } : {}),
        },
      }));
    if (ranges.length) company.OR = ranges;
  }

  if (Object.keys(company).length) and.push({ company });

  // "At least N contacts at this company" — counts Person rows in this CRM, not real headcount.
  // Resolved by the action into a company-id list (Prisma has no relation-count filter).
  if (f.minContactsAtCompany && f.minContactsAtCompany > 1) {
    and.push({ companyId: { in: opts.resolved?.companyIdsWithEnoughContacts ?? [] } });
  }

  // --- Retargeting angles (OR between the selected ones) ---
  if (f.engagement?.length) {
    const or: Prisma.PersonWhereInput[] = [];
    for (const angle of f.engagement) {
      if (angle === "touched_no_reply") {
        // Was enrolled in at least one campaign and has no reply recorded on any membership.
        or.push({
          AND: [{ campaignMembers: { some: {} } }, { campaignMembers: { none: { repliedAt: { not: null } } } }],
        });
      } else if (angle === "never_contacted") {
        or.push({ campaignMembers: { none: {} } });
      } else if (angle === "cold") {
        // No Activity newer than the cutoff. Activity is polymorphic with no Person relation,
        // so the action resolves the recently-active ids and we exclude them here. The
        // createdAt guard stops brand-new contacts (added after the cutoff, no activity yet)
        // from being labelled "gone cold".
        or.push({
          id: { notIn: opts.resolved?.recentlyActiveIds ?? [] },
          createdAt: { lt: opts.coldBefore },
        });
      }
    }
    if (or.length) and.push({ OR: or });
  }

  // --- Custom fields (EAV) ---
  // CustomFieldValue.recordId has no FK to Person, so these can't be relation filters. The
  // action intersects the matching record ids per selected field (AND across fields, OR within
  // one) and passes the result in. Equality only: `value` is text for every field type, so
  // numeric/date comparison would need a cast and an index that doesn't exist.
  if (f.customFields?.length) {
    and.push({ id: { in: opts.resolved?.customFieldMatchIds ?? [] } });
  }

  return and.length ? { AND: and } : {};
}
