// Single source of truth for what the report builder UI can offer and what the query
// executor (custom-reports.ts) is allowed to build — the UI only ever renders options that
// come from here, and the executor only ever reads field names it finds here. That's what
// keeps this a query *builder* instead of a SQL injection surface: nothing user-typed ever
// reaches a Prisma `where`/`orderBy`/`groupBy` key, only values looked up from this registry.

export type ReportEntity = "person" | "opportunity" | "company" | "task" | "activity" | "call" | "email";

export type FieldKind = "string" | "enum" | "date" | "owner" | "boolean" | "number";

export type FieldDef = {
  key: string; // Prisma field name (or dotted relation path resolved manually in custom-reports.ts)
  label: string;
  kind: FieldKind;
  options?: { value: string; label: string }[]; // for kind: "enum" — filter dropdown choices
  groupable?: boolean;
  filterable?: boolean;
  // For kind: "boolean" fields backed by a nullable DateTime column (e.g. unsubscribedAt) rather
  // than a real boolean — "true" means the column is set, "false" means it's null. Read by
  // buildFilterWhere/bucketKey to translate the boolean UI into the right where-clause shape.
  booleanBackedByDate?: boolean;
};

export type EntityDef = {
  label: string;
  labelPlural: string;
  fields: FieldDef[];
  supportsSumValue: boolean; // only Opportunity has a numeric "value" worth summing
};

const OWNER_FIELD: FieldDef = { key: "ownerId", label: "Owner", kind: "owner", groupable: true, filterable: true };
const CREATED_BY_FIELD: FieldDef = { key: "createdById", label: "Created by", kind: "owner", groupable: true, filterable: true };
const CREATED_AT_FIELD: FieldDef = { key: "createdAt", label: "Created date", kind: "date", groupable: true, filterable: true };

export const ENTITY_REGISTRY: Record<ReportEntity, EntityDef> = {
  person: {
    label: "Contact",
    labelPlural: "Contacts",
    supportsSumValue: false,
    fields: [
      OWNER_FIELD,
      CREATED_BY_FIELD,
      CREATED_AT_FIELD,
      { key: "stage", label: "Pipeline stage", kind: "string", groupable: true, filterable: true },
      { key: "companyId", label: "Company", kind: "string", groupable: true, filterable: false },
      { key: "unsubscribedAt", label: "Unsubscribed", kind: "boolean", groupable: true, filterable: true, booleanBackedByDate: true },
    ],
  },
  opportunity: {
    label: "Deal",
    labelPlural: "Deals",
    supportsSumValue: true,
    fields: [
      OWNER_FIELD,
      CREATED_BY_FIELD,
      CREATED_AT_FIELD,
      { key: "stage", label: "Stage", kind: "string", groupable: true, filterable: true },
      { key: "closeDate", label: "Close date", kind: "date", groupable: true, filterable: true },
      { key: "expectedCloseDate", label: "Expected close date", kind: "date", groupable: true, filterable: true },
      { key: "companyId", label: "Company", kind: "string", groupable: true, filterable: false },
    ],
  },
  company: {
    label: "Company",
    labelPlural: "Companies",
    supportsSumValue: false,
    fields: [OWNER_FIELD, CREATED_BY_FIELD, CREATED_AT_FIELD],
  },
  task: {
    label: "Task",
    labelPlural: "Tasks",
    supportsSumValue: false,
    fields: [
      CREATED_BY_FIELD,
      CREATED_AT_FIELD,
      { key: "dueAt", label: "Due date", kind: "date", groupable: true, filterable: true },
      {
        key: "type",
        label: "Type",
        kind: "enum",
        groupable: true,
        filterable: true,
        options: [
          { value: "call", label: "Call" },
          { value: "email", label: "Email" },
          { value: "event", label: "Event" },
          { value: "meet", label: "Meet" },
          { value: "general", label: "General" },
        ],
      },
      {
        key: "priority",
        label: "Priority",
        kind: "enum",
        groupable: true,
        filterable: true,
        options: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
        ],
      },
      {
        key: "done",
        label: "Completed",
        kind: "boolean",
        groupable: true,
        filterable: true,
        options: [
          { value: "true", label: "Done" },
          { value: "false", label: "Not done" },
        ],
      },
    ],
  },
  activity: {
    label: "Activity",
    labelPlural: "Activity events",
    supportsSumValue: false,
    fields: [
      { key: "actorId", label: "Actor", kind: "owner", groupable: true, filterable: true },
      CREATED_AT_FIELD,
      {
        key: "entityType",
        label: "Entity type",
        kind: "enum",
        groupable: true,
        filterable: true,
        options: [
          { value: "person", label: "Contact" },
          { value: "company", label: "Company" },
          { value: "opportunity", label: "Deal" },
        ],
      },
      {
        key: "kind",
        label: "Event kind",
        kind: "enum",
        groupable: true,
        filterable: true,
        options: [
          { value: "created", label: "Created" },
          { value: "field_update", label: "Field updated" },
          { value: "opportunity_created", label: "Deal created" },
          { value: "stage_changed", label: "Stage changed" },
          { value: "task_created", label: "Task created" },
          { value: "task_completed", label: "Task completed" },
          { value: "email_sent", label: "Email sent" },
        ],
      },
    ],
  },
  call: {
    label: "Call",
    labelPlural: "Calls",
    supportsSumValue: false,
    fields: [
      CREATED_BY_FIELD,
      { key: "startedAt", label: "Date", kind: "date", groupable: true, filterable: true },
      {
        key: "status",
        label: "Status",
        kind: "enum",
        groupable: true,
        filterable: true,
        options: [
          { value: "initiated", label: "Initiated" },
          { value: "ringing", label: "Ringing" },
          { value: "in-progress", label: "In progress" },
          { value: "completed", label: "Completed" },
          { value: "failed", label: "Failed" },
          { value: "no-answer", label: "No answer" },
          { value: "busy", label: "Busy" },
        ],
      },
      {
        key: "disposition",
        label: "Outcome",
        kind: "enum",
        groupable: true,
        filterable: true,
        options: [
          { value: "interested", label: "Interested" },
          { value: "not-interested", label: "Not interested" },
          { value: "voicemail", label: "Voicemail" },
          { value: "callback", label: "Callback" },
          { value: "no-answer", label: "No answer" },
          { value: "wrong-number", label: "Wrong number" },
        ],
      },
    ],
  },
  email: {
    label: "Email",
    labelPlural: "Emails",
    supportsSumValue: false,
    fields: [
      { key: "senderId", label: "Sender", kind: "owner", groupable: true, filterable: true },
      { key: "sentAt", label: "Date", kind: "date", groupable: true, filterable: true },
      {
        key: "direction",
        label: "Direction",
        kind: "enum",
        groupable: true,
        filterable: true,
        options: [
          { value: "sent", label: "Sent" },
          { value: "received", label: "Received" },
        ],
      },
      // Derived from the `opens` relation (EmailOpen rows), not a real column — see
      // RELATION_DERIVED_FIELDS in custom-reports.ts for how the executor handles this.
      // "Opened" here means at least one open recorded (a unique-open proxy), not a raw open count.
      { key: "opened", label: "Opened", kind: "boolean", groupable: true, filterable: true },
    ],
  },
};

// Shared by custom-reports.ts and custom-dashboards.ts (report + dashboard-widget config have
// the identical entity/filters/groupBy/aggregate shape) — lives outside any "use server" file
// since it's a plain sync helper, and Server Action files may only export async functions.
export function validateReportInput(input: {
  name: string;
  entity: ReportEntity;
  filters: CustomReportFilter[];
  groupBy: string | null;
  aggregate: "count" | "sum_value";
  dateGranularity?: string;
}): string {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required");

  for (const filter of input.filters) {
    if (!getFieldDef(input.entity, filter.field)) throw new Error(`Unknown filter field: ${filter.field}`);
  }
  if (input.groupBy && !getFieldDef(input.entity, input.groupBy)?.groupable) {
    throw new Error(`Field is not groupable: ${input.groupBy}`);
  }
  if (input.aggregate === "sum_value" && input.entity !== "opportunity") {
    throw new Error("sum_value is only valid for deals");
  }
  if (input.dateGranularity && input.dateGranularity !== "day") {
    const groupByKind = input.groupBy ? getFieldDef(input.entity, input.groupBy)?.kind : undefined;
    if (groupByKind !== "date") throw new Error("dateGranularity is only valid when grouping by a date field");
  }
  return name;
}

export function getEntityDef(entity: ReportEntity): EntityDef {
  return ENTITY_REGISTRY[entity];
}

export function getFieldDef(entity: ReportEntity, key: string): FieldDef | undefined {
  return ENTITY_REGISTRY[entity].fields.find((f) => f.key === key);
}

export type DateFilterOp = "last_7_days" | "last_30_days" | "last_90_days" | "this_month" | "all_time" | "custom";

export type CustomReportFilter =
  | { field: string; kind: "owner"; values: string[] } // each value is a userId, or "unowned"
  | { field: string; kind: "enum" | "string" | "boolean"; value: string }
  | { field: string; kind: "date"; op: DateFilterOp; start?: string; end?: string }; // start/end are ISO date strings, only used when op === "custom"

// Old single-value shape, from before the owner filter became multi-select — CustomReport.filters
// and DashboardWidget.filters are stored as JSON, so filters saved before this change still have
// `{value: string}` instead of `{values: string[]}`. Coerce on read so old saved reports/widgets
// keep working without a backfill migration. Permanent shim, not a TODO — nothing here ever
// removes the old shape from the database.
type LegacyOwnerFilter = { field: string; kind: "owner"; value: string };

export function normalizeFilter(raw: CustomReportFilter | LegacyOwnerFilter): CustomReportFilter {
  if (raw.kind === "owner" && "value" in raw) {
    return { field: raw.field, kind: "owner", values: [raw.value] };
  }
  return raw;
}

export const DATE_FILTER_LABELS: Record<DateFilterOp, string> = {
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
  last_90_days: "Last 90 days",
  this_month: "This month",
  all_time: "All time",
  custom: "Custom range",
};

export function dateFilterToRange(op: DateFilterOp, start?: string, end?: string): { gte: Date; lte?: Date } | undefined {
  if (op === "all_time") return undefined;
  if (op === "custom") {
    if (!start) return undefined;
    const gte = new Date(start);
    const lte = end ? new Date(end) : undefined;
    if (lte) lte.setHours(23, 59, 59, 999); // end date is inclusive of the whole day
    return { gte, lte };
  }
  const now = new Date();
  if (op === "this_month") {
    return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
  const days = op === "last_7_days" ? 7 : op === "last_30_days" ? 30 : 90;
  const gte = new Date(now);
  gte.setDate(gte.getDate() - days);
  return { gte };
}

// ISO-8601 week key, e.g. "2026-W04" — sorts correctly as a plain string since year comes
// first and week is zero-padded. No date library: ISO week is "the week containing this
// year's first Thursday", a fixed ~10-line calculation, not worth a dependency for.
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Sunday (0) -> 7, so Monday is always day 1
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // move to this week's Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
