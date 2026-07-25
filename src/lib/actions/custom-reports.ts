"use server";

import { revalidatePath } from "next/cache";
import { requireWorkspace, personVisibilityFilter, opportunityVisibilityFilter, companyVisibilityFilter } from "@/lib/workspace";
import { db } from "@/lib/db";
import {
  getFieldDef,
  dateFilterToRange,
  validateReportInput,
  normalizeFilter,
  isoWeekKey,
  type ReportEntity,
  type CustomReportFilter,
} from "@/lib/custom-report-registry";

export type Aggregate = "count" | "sum_value";
export type Display = "table" | "bar" | "line" | "pie";
export type DateGranularity = "day" | "week" | "month" | "year";

export type CreateCustomReportInput = {
  name: string;
  entity: ReportEntity;
  filters: CustomReportFilter[];
  groupBy: string | null;
  aggregate: Aggregate;
  display: Display;
  dateGranularity?: DateGranularity;
};

export async function listCustomReports() {
  const { workspaceId } = await requireWorkspace();
  return db.customReport.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
}

export async function getCustomReport(id: string) {
  const { workspaceId } = await requireWorkspace();
  return db.customReport.findUnique({ where: { id, workspaceId } });
}

export async function createCustomReport(input: CreateCustomReportInput) {
  const { userId, workspaceId } = await requireWorkspace();
  const name = validateReportInput(input);

  const report = await db.customReport.create({
    data: {
      workspaceId,
      name,
      entity: input.entity,
      filters: input.filters,
      groupBy: input.groupBy,
      aggregate: input.aggregate,
      display: input.display,
      dateGranularity: input.dateGranularity ?? "day",
      createdById: userId,
    },
  });

  revalidatePath("/dashboards");
  return report;
}

export async function updateCustomReport(id: string, input: CreateCustomReportInput) {
  const { workspaceId } = await requireWorkspace();
  const name = validateReportInput(input);

  await db.customReport.update({
    where: { id, workspaceId },
    data: {
      name,
      entity: input.entity,
      filters: input.filters,
      groupBy: input.groupBy,
      aggregate: input.aggregate,
      display: input.display,
      dateGranularity: input.dateGranularity ?? "day",
    },
  });

  revalidatePath("/dashboards");
  revalidatePath(`/dashboards/report/${id}`);
}

export async function deleteCustomReport(id: string) {
  const { workspaceId } = await requireWorkspace();
  await db.customReport.delete({ where: { id, workspaceId } });
  revalidatePath("/dashboards");
}

// --- Execution ---

type Ctx = Awaited<ReturnType<typeof requireWorkspace>>;

// Every entity's visibility-scoped base `where` — a member only ever sees their own rows for
// Person/Opportunity/Task (via personId)/Call(via personId); Activity/Email don't have a
// per-row owner concept in the same way, so they're scoped to workspace only (matches how
// /inbox and the sales-tracking dashboard already treat them).
async function baseWhere(ctx: Ctx, entity: ReportEntity): Promise<Record<string, unknown>> {
  const { workspaceId } = ctx;
  switch (entity) {
    case "person":
      return { workspaceId, ...personVisibilityFilter(ctx) };
    case "opportunity":
      return { workspaceId, ...opportunityVisibilityFilter(ctx) };
    case "company":
      return { workspaceId, ...companyVisibilityFilter(ctx) };
    case "task":
    case "call":
    case "email":
    case "activity":
      return { workspaceId };
  }
}

function buildFilterWhere(entity: ReportEntity, rawFilters: CustomReportFilter[]): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  for (const raw of rawFilters) {
    const filter = normalizeFilter(raw);
    const def = getFieldDef(entity, filter.field);
    if (!def) continue; // already validated at write time, but stay defensive on read too

    if (filter.kind === "date") {
      const range = dateFilterToRange(filter.op, filter.start, filter.end);
      if (range) where[filter.field] = range.lte ? { gte: range.gte, lte: range.lte } : { gte: range.gte };
      continue;
    }
    if (filter.kind === "owner") {
      const realIds = filter.values.filter((v) => v !== "unowned");
      const includesUnowned = filter.values.includes("unowned");
      if (includesUnowned && realIds.length > 0) {
        where.OR = [{ [filter.field]: null }, { [filter.field]: { in: realIds } }];
      } else if (includesUnowned) {
        where[filter.field] = null;
      } else {
        where[filter.field] = { in: realIds };
      }
      continue;
    }
    if (filter.kind === "boolean") {
      // "opened" is derived from the `opens` relation, not a real column — filter via a
      // some/none check on that relation instead of a scalar equality.
      if (filter.field === "opened") {
        where.opens = filter.value === "true" ? { some: {} } : { none: {} };
        continue;
      }
      // "unsubscribedAt"-style fields are nullable dates standing in for a boolean (see
      // person's unsubscribedAt FieldDef) — "true" means the date is set, "false" means null.
      if (def.kind === "boolean" && def.booleanBackedByDate) {
        where[filter.field] = filter.value === "true" ? { not: null } : null;
      } else {
        where[filter.field] = filter.value === "true";
      }
      continue;
    }
    where[filter.field] = filter.value;
  }
  return where;
}

const MODEL_BY_ENTITY = {
  person: "person",
  opportunity: "opportunity",
  company: "company",
  task: "task",
  activity: "activity",
  call: "call",
  email: "email",
} as const;

// rawValue is the bucket key before label resolution (a userId for owner groups, the raw
// enum/string value otherwise, or "—" for null) — pass it back to getCustomReportRows for an
// exact-match drill-down instead of re-deriving it from the display label.
export type ReportGroupRow = { label: string; rawValue: string; value: number };
export type ReportResult = { total: number; groups: ReportGroupRow[] | null };

async function resolveOwnerLabels(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const users = await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
  return new Map(users.map((u) => [u.id, u.name ?? u.email ?? "Unknown"]));
}

// Runs a saved (or draft, for the live preview in the builder) report definition and returns
// the aggregate. Deliberately fetches matching rows and aggregates in JS rather than a
// Prisma `groupBy` — the entity/field set is small enough that this stays fast, and it avoids
// six near-duplicate groupBy call sites (one per entity, since Prisma's groupBy is generated
// per-model and can't be parameterized the way `db[modelName]` dynamic access can for reads).
// Fields that aren't real scalar Prisma columns — "opened" is derived from the `opens` relation
// (EmailOpen rows), so it needs its own select/read shape instead of the generic `{[field]:true}`.
// Kept to this one field; anything with a similar shape in the future either denormalizes into a
// real column (see the CampaignMember decision) or gets added here deliberately, not by default.
const RELATION_DERIVED_FIELDS = new Set(["opened"]);

async function resolveCompanyLabels(companyIds: string[]): Promise<Map<string, string>> {
  if (companyIds.length === 0) return new Map();
  const companies = await db.company.findMany({ where: { id: { in: companyIds } }, select: { id: true, name: true } });
  return new Map(companies.map((c) => [c.id, c.name]));
}

export async function runCustomReport(input: {
  entity: ReportEntity;
  filters: CustomReportFilter[];
  groupBy: string | null;
  aggregate: Aggregate;
  dateGranularity?: DateGranularity;
}): Promise<ReportResult> {
  const ctx = await requireWorkspace();

  for (const filter of input.filters) {
    if (!getFieldDef(input.entity, filter.field)) throw new Error(`Unknown filter field: ${filter.field}`);
  }
  if (input.groupBy && !getFieldDef(input.entity, input.groupBy)?.groupable) {
    throw new Error(`Field is not groupable: ${input.groupBy}`);
  }

  const where = { ...(await baseWhere(ctx, input.entity)), ...buildFilterWhere(input.entity, input.filters) };
  const modelName = MODEL_BY_ENTITY[input.entity];
  // db[modelName] is a controlled dynamic lookup into a fixed 7-entry map above, not an
  // arbitrary user-supplied model name — TypeScript can't express "any Prisma delegate with a
  // findMany", so this one cast is deliberate rather than a hole in the validation above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (db as any)[modelName];

  const selectField = input.groupBy ?? undefined;
  const isRelationField = selectField ? RELATION_DERIVED_FIELDS.has(selectField) : false;
  // Prisma rejects an empty `select` outright — an ungrouped count needs no columns at all,
  // so fall back to selecting `id` just to keep the object non-empty.
  const rows: Record<string, unknown>[] = await model.findMany({
    where,
    select: {
      ...(selectField && !isRelationField ? { [selectField]: true } : {}),
      ...(selectField === "opened" ? { opens: { select: { id: true }, take: 1 } } : {}),
      ...(input.aggregate === "sum_value" ? { value: true } : {}),
      ...(selectField || input.aggregate === "sum_value" ? {} : { id: true }),
    },
  });

  if (!input.groupBy) {
    const total =
      input.aggregate === "sum_value" ? rows.reduce((sum, r) => sum + (Number(r.value) || 0), 0) : rows.length;
    return { total, groups: null };
  }

  const fieldDef = getFieldDef(input.entity, input.groupBy)!;
  const granularity = input.dateGranularity ?? "day";
  const buckets = new Map<string, number>();
  for (const row of rows) {
    const raw = input.groupBy === "opened" ? (row.opens as unknown[]).length > 0 : row[input.groupBy];
    const key = bucketKey(raw, fieldDef, granularity);
    const amount = input.aggregate === "sum_value" ? Number(row.value) || 0 : 1;
    buckets.set(key, (buckets.get(key) ?? 0) + amount);
  }

  let groups: ReportGroupRow[];
  if (fieldDef.kind === "owner") {
    const labels = await resolveOwnerLabels([...buckets.keys()].filter((k) => k !== "—"));
    groups = [...buckets.entries()].map(([key, value]) => ({
      label: key === "—" ? "Unowned" : labels.get(key) ?? "Unknown",
      rawValue: key,
      value,
    }));
  } else if (input.groupBy === "companyId") {
    const labels = await resolveCompanyLabels([...buckets.keys()].filter((k) => k !== "—"));
    groups = [...buckets.entries()].map(([key, value]) => ({
      label: key === "—" ? "No company" : labels.get(key) ?? "Unknown",
      rawValue: key,
      value,
    }));
  } else if (fieldDef.options) {
    const optionLabels = new Map(fieldDef.options.map((o) => [o.value, o.label]));
    groups = [...buckets.entries()].map(([key, value]) => ({ label: optionLabels.get(key) ?? key, rawValue: key, value }));
  } else if (fieldDef.kind === "boolean") {
    const labels: Record<string, string> = { true: "Yes", false: "No", "—": "Unknown" };
    groups = [...buckets.entries()].map(([key, value]) => ({ label: labels[key] ?? key, rawValue: key, value }));
  } else {
    groups = [...buckets.entries()].map(([key, value]) => ({ label: key, rawValue: key, value }));
  }
  // Date groupBy sorts chronologically (bucket keys are ISO-prefix-sortable) so a line chart
  // reads left-to-right in time order; every other kind sorts by value for the bar/table view.
  if (fieldDef.kind === "date") {
    groups.sort((a, b) => a.rawValue.localeCompare(b.rawValue));
  } else {
    groups.sort((a, b) => b.value - a.value);
  }

  const total = groups.reduce((sum, g) => sum + g.value, 0);
  return { total, groups };
}

function bucketKey(raw: unknown, fieldDef: { kind: string; booleanBackedByDate?: boolean }, granularity: DateGranularity): string {
  if (raw === null || raw === undefined) return "—";
  if (fieldDef.kind === "boolean" && fieldDef.booleanBackedByDate) {
    return raw instanceof Date ? "true" : "false";
  }
  if (fieldDef.kind === "boolean") return String(raw);
  if (fieldDef.kind === "date" && raw instanceof Date) {
    if (granularity === "week") return isoWeekKey(raw);
    if (granularity === "month") return raw.toISOString().slice(0, 7);
    if (granularity === "year") return raw.toISOString().slice(0, 4);
    return raw.toISOString().slice(0, 10); // day
  }
  if (typeof raw === "boolean") return String(raw);
  return String(raw);
}

export type DrillDownRow = { id: string; title: string; subtitle: string; href: string };

// Behind a group-bar click: the actual rows in that bucket.
export async function getCustomReportRows(input: {
  entity: ReportEntity;
  filters: CustomReportFilter[];
  groupBy: string | null;
  groupValue: string | null; // a group's rawValue from runCustomReport's ReportGroupRow, not its display label
}): Promise<DrillDownRow[]> {
  const ctx = await requireWorkspace();

  for (const filter of input.filters) {
    if (!getFieldDef(input.entity, filter.field)) throw new Error(`Unknown filter field: ${filter.field}`);
  }

  const where = { ...(await baseWhere(ctx, input.entity)), ...buildFilterWhere(input.entity, input.filters) };
  if (input.groupBy && input.groupValue !== null) {
    where[input.groupBy] = input.groupValue === "—" ? null : input.groupValue;
  }

  return fetchRowsForDisplay(input.entity, where);
}

async function fetchRowsForDisplay(entity: ReportEntity, where: Record<string, unknown>): Promise<DrillDownRow[]> {
  const take = 100;
  switch (entity) {
    case "person": {
      const rows = await db.person.findMany({ where, orderBy: { createdAt: "desc" }, take, select: { id: true, firstName: true, lastName: true, email: true } });
      return rows.map((p) => ({ id: p.id, title: [p.firstName, p.lastName].filter(Boolean).join(" ") || "Untitled", subtitle: p.email ?? "", href: `/contacts/${p.id}` }));
    }
    case "opportunity": {
      const rows = await db.opportunity.findMany({ where, orderBy: { createdAt: "desc" }, take, select: { id: true, name: true, value: true, stage: true } });
      return rows.map((o) => ({ id: o.id, title: o.name || "Untitled", subtitle: `${o.stage} · $${o.value.toLocaleString()}`, href: `/deals/${o.id}` }));
    }
    case "company": {
      const rows = await db.company.findMany({ where, orderBy: { createdAt: "desc" }, take, select: { id: true, name: true, domain: true } });
      return rows.map((c) => ({ id: c.id, title: c.name || "Untitled", subtitle: c.domain ?? "", href: `/companies/${c.id}` }));
    }
    case "task": {
      const rows = await db.task.findMany({ where, orderBy: { createdAt: "desc" }, take, select: { id: true, title: true, type: true, personId: true } });
      return rows.map((t) => ({ id: t.id, title: t.title, subtitle: t.type, href: `/contacts/${t.personId}` }));
    }
    case "activity": {
      const rows = await db.activity.findMany({ where, orderBy: { createdAt: "desc" }, take, select: { id: true, kind: true, entityType: true, entityId: true, field: true } });
      return rows.map((a) => ({
        id: a.id,
        title: a.field ? `${a.kind}: ${a.field}` : a.kind,
        subtitle: a.entityType,
        href: a.entityType === "person" ? `/contacts/${a.entityId}` : a.entityType === "opportunity" ? `/deals/${a.entityId}` : `/companies/${a.entityId}`,
      }));
    }
    case "call": {
      const rows = await db.call.findMany({ where, orderBy: { startedAt: "desc" }, take, select: { id: true, toNumber: true, status: true, personId: true } });
      return rows.map((c) => ({ id: c.id, title: c.toNumber, subtitle: c.status, href: c.personId ? `/contacts/${c.personId}` : "/calendar" }));
    }
    case "email": {
      const rows = await db.email.findMany({ where, orderBy: { sentAt: "desc" }, take, select: { id: true, subject: true, direction: true, personId: true } });
      return rows.map((e) => ({ id: e.id, title: e.subject || "(no subject)", subtitle: e.direction, href: e.personId ? `/contacts/${e.personId}` : "/inbox" }));
    }
  }
}
