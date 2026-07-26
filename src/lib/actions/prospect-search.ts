"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireWorkspace, personVisibilityFilter } from "@/lib/workspace";
import { buildProspectWhere, type PreResolved } from "@/lib/prospect-where";
import { PROSPECT_PAGE_SIZE, type ProspectFilters } from "@/lib/prospect-filters";
import { INDUSTRIES, COUNTRIES, REVENUE_RANGES, EMPLOYEE_BUCKETS } from "@/lib/firmographics";
import { SENIORITIES, SENIORITY_LABELS, DEPARTMENTS, DEPARTMENT_LABELS } from "@/lib/job-title";
import { addManyContactsToCampaign } from "@/lib/actions/campaigns";
import type { FilterOption } from "@/components/filter-picker";

function coldCutoff(days: number | undefined) {
  const d = new Date();
  d.setDate(d.getDate() - (days ?? 90));
  return d;
}

// Resolves the filters that can't be expressed as Prisma relation filters (see PreResolved).
// Each branch runs only when its filter is actually selected, so an unfiltered search costs
// nothing extra.
async function preResolve(workspaceId: string, f: ProspectFilters): Promise<PreResolved> {
  const resolved: PreResolved = {};

  if (f.engagement?.includes("cold")) {
    const recent = await db.activity.findMany({
      where: { workspaceId, entityType: "person", createdAt: { gte: coldCutoff(f.coldDays) } },
      select: { entityId: true },
      distinct: ["entityId"],
    });
    resolved.recentlyActiveIds = recent.map((a) => a.entityId);
  }

  if (f.customFields?.length) {
    // Intersect per field so multiple custom-field filters AND together.
    // `undefined` means "no field has constrained the set yet", distinct from an empty set.
    let matched: Set<string> | undefined;
    for (const cf of f.customFields) {
      const rows = await db.customFieldValue.findMany({
        where: {
          workspaceId,
          definitionId: cf.definitionId,
          ...(cf.mode === "in" ? { value: { in: cf.values } } : {}),
          ...(cf.mode === "set" ? { NOT: { value: null } } : {}),
        },
        select: { recordId: true },
      });
      const ids = new Set(rows.map((r) => r.recordId));

      if (cf.mode === "unset") {
        // "Not set" is a complement, so it needs a candidate set to subtract from.
        const base =
          matched ??
          new Set((await db.person.findMany({ where: { workspaceId }, select: { id: true } })).map((p) => p.id));
        for (const id of ids) base.delete(id);
        matched = base;
      } else if (matched === undefined) {
        matched = ids;
      } else {
        matched = new Set([...matched].filter((id: string) => ids.has(id)));
      }
    }
    resolved.customFieldMatchIds = [...(matched ?? [])];
  }

  if (f.minContactsAtCompany && f.minContactsAtCompany > 1) {
    const grouped = await db.person.groupBy({
      by: ["companyId"],
      where: { workspaceId, deletedAt: null, companyId: { not: null } },
      _count: { _all: true },
    });
    resolved.companyIdsWithEnoughContacts = grouped
      .filter((g) => g._count._all >= f.minContactsAtCompany!)
      .map((g) => g.companyId!)
      .filter(Boolean);
  }

  return resolved;
}

export async function searchProspects(filters: ProspectFilters) {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  const resolved = await preResolve(workspaceId, filters);
  const where = {
    workspaceId,
    ...personVisibilityFilter(ctx),
    ...buildProspectWhere(filters, { coldBefore: coldCutoff(filters.coldDays), resolved }),
  };

  const page = Math.max(1, filters.page ?? 1);

  const [total, people] = await Promise.all([
    db.person.count({ where }),
    db.person.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PROSPECT_PAGE_SIZE,
      take: PROSPECT_PAGE_SIZE,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        jobTitle: true,
        seniority: true,
        department: true,
        stage: true,
        unsubscribedAt: true,
        emailVerifiedStatus: true,
        owner: { select: { id: true, name: true, email: true } },
        company: {
          select: {
            id: true,
            name: true,
            industry: true,
            country: true,
            revenueRange: true,
            employeeCount: true,
            _count: { select: { people: true } },
          },
        },
      },
    }),
  ]);

  return {
    people,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PROSPECT_PAGE_SIZE)),
  };
}

// Returns every id matching the current filters, ignoring pagination — backs the
// "select all N results" action so a 3,000-row audience doesn't need 60 page fetches.
export async function listAllProspectIds(filters: ProspectFilters) {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;

  const resolved = await preResolve(workspaceId, filters);
  const rows = await db.person.findMany({
    where: {
      workspaceId,
      ...personVisibilityFilter(ctx),
      ...buildProspectWhere(filters, { coldBefore: coldCutoff(filters.coldDays), resolved }),
    },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

// Saves the current selection as a static list, so an audience can be reused (and attached to
// a campaign later) without re-running the filters. Reuses the same List/ListItem the rest of
// the app uses, so it shows up on /lists like any other.
export async function saveProspectsAsList(name: string, personIds: string[]) {
  const ctx = await requireWorkspace();
  const { userId, workspaceId } = ctx;
  const trimmed = name.trim();
  if (!trimmed) throw new Error("List name is required");
  if (personIds.length === 0) throw new Error("Select at least one contact");

  // Scope the ids to this workspace (and to what the caller may see) before writing — the
  // client sends them back, so they can't be trusted as-is.
  const allowed = await db.person.findMany({
    where: { id: { in: personIds }, workspaceId, ...personVisibilityFilter(ctx) },
    select: { id: true },
  });

  const list = await db.list.create({
    data: { workspaceId, name: trimmed, entityType: "person", createdById: userId },
  });
  await db.listItem.createMany({
    data: allowed.map((p) => ({ workspaceId, listId: list.id, entityId: p.id })),
    skipDuplicates: true,
  });

  revalidatePath("/lists");
  return { listId: list.id, added: allowed.length };
}

// Adds the current selection straight to a campaign. Delegates to the campaign action so the
// enrolment/dedupe rules stay in one place; ids are re-scoped here first for the same reason
// as saveProspectsAsList.
export async function addProspectsToCampaign(campaignId: string, personIds: string[]) {
  const ctx = await requireWorkspace();
  if (personIds.length === 0) throw new Error("Select at least one contact");

  const allowed = await db.person.findMany({
    where: {
      id: { in: personIds },
      workspaceId: ctx.workspaceId,
      ...personVisibilityFilter(ctx),
      // Never enrol someone who can't legally be emailed, even if the caller opted to view
      // unsubscribed contacts in the results.
      unsubscribedAt: null,
    },
    select: { id: true },
  });

  await addManyContactsToCampaign(campaignId, allowed.map((p) => p.id));
  return { added: allowed.length, skipped: personIds.length - allowed.length };
}

// Options for every picker. Curated lists are unioned with the distinct values actually
// present in the workspace, and each option carries its live count as a hint — so a filter
// that would return nothing is visible as such before it's clicked.
export async function listProspectFilterOptions() {
  const ctx = await requireWorkspace();
  const { workspaceId } = ctx;
  const scope = { workspaceId, ...personVisibilityFilter(ctx) };

  const [
    seniorityCounts,
    departmentCounts,
    stageCounts,
    industryCounts,
    countryCounts,
    revenueCounts,
    members,
    batches,
    campaigns,
    customFieldDefs,
  ] = await Promise.all([
    db.person.groupBy({ by: ["seniority"], where: scope, _count: { _all: true } }),
    db.person.groupBy({ by: ["department"], where: scope, _count: { _all: true } }),
    db.person.groupBy({ by: ["stage"], where: scope, _count: { _all: true } }),
    db.company.groupBy({ by: ["industry"], where: { workspaceId, deletedAt: null }, _count: { _all: true } }),
    db.company.groupBy({ by: ["country"], where: { workspaceId, deletedAt: null }, _count: { _all: true } }),
    db.company.groupBy({ by: ["revenueRange"], where: { workspaceId, deletedAt: null }, _count: { _all: true } }),
    db.workspaceMember.findMany({
      where: { workspaceId },
      select: { user: { select: { id: true, name: true, email: true } } },
    }),
    db.importBatch.findMany({
      where: { workspaceId, objectType: "person" },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, createdAt: true },
      take: 50,
    }),
    db.campaign.findMany({ where: { workspaceId }, select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
    db.customFieldDefinition.findMany({
      where: { workspaceId, objectType: "person" },
      orderBy: { order: "asc" },
      select: { id: true, label: true, type: true, options: true },
    }),
  ]);

  // Curated entries first (so an empty workspace still has a usable picker), then any value
  // that exists in the data but isn't curated. Sorted by count desc, so what you actually
  // have floats to the top.
  function merge(curated: readonly string[], counts: { [k: string]: unknown; _count: { _all: number } }[], key: string): FilterOption[] {
    const byValue = new Map<string, number>();
    for (const row of counts) {
      const value = row[key];
      if (typeof value === "string" && value.trim()) byValue.set(value, row._count._all);
    }
    const all = [...new Set([...curated, ...byValue.keys()])];
    return all
      .map((value) => ({ id: value, label: value, count: byValue.get(value) ?? 0 }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .map(({ id, label, count }) => ({ id, label, hint: count ? String(count) : undefined }));
  }

  function labelled(
    keys: readonly string[],
    labels: Record<string, string>,
    counts: { [k: string]: unknown; _count: { _all: number } }[],
    key: string
  ): FilterOption[] {
    const byValue = new Map<string, number>();
    for (const row of counts) {
      const value = row[key];
      if (typeof value === "string" && value) byValue.set(value, row._count._all);
    }
    return keys.map((k) => ({
      id: k,
      label: labels[k] ?? k,
      hint: byValue.get(k) ? String(byValue.get(k)) : undefined,
    }));
  }

  return {
    seniority: labelled(SENIORITIES, SENIORITY_LABELS, seniorityCounts, "seniority"),
    department: labelled(DEPARTMENTS, DEPARTMENT_LABELS, departmentCounts, "department"),
    stage: merge([], stageCounts, "stage"),
    industry: merge(INDUSTRIES, industryCounts, "industry"),
    country: merge(COUNTRIES, countryCounts, "country"),
    revenueRange: merge(REVENUE_RANGES, revenueCounts, "revenueRange"),
    employeeBuckets: EMPLOYEE_BUCKETS.map((b) => ({ id: b.id, label: b.label })),
    owners: members
      .filter((m) => m.user)
      .map((m) => ({ id: m.user.id, label: m.user.name ?? m.user.email ?? "Unknown" })),
    importBatches: batches.map((b) => ({
      id: b.id,
      label: b.name,
      hint: b.createdAt.toLocaleDateString(),
    })),
    campaigns: campaigns.map((c) => ({ id: c.id, label: c.name })),
    customFields: customFieldDefs.map((d) => ({
      id: d.id,
      label: d.label,
      type: d.type,
      options: d.options,
    })),
  };
}
