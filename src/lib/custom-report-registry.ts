// Single source of truth for what the report builder UI can offer and what the query
// executor (custom-reports.ts) is allowed to build — the UI only ever renders options that
// come from here, and the executor only ever reads field names it finds here. That's what
// keeps this a query *builder* instead of a SQL injection surface: nothing user-typed ever
// reaches a Prisma `where`/`orderBy`/`groupBy` key, only values looked up from this registry.

export type ReportEntity = "person" | "opportunity" | "task" | "activity" | "call" | "email";

export type FieldKind = "string" | "enum" | "date" | "owner" | "boolean" | "number";

export type FieldDef = {
  key: string; // Prisma field name (or dotted relation path resolved manually in custom-reports.ts)
  label: string;
  kind: FieldKind;
  options?: { value: string; label: string }[]; // for kind: "enum" — filter dropdown choices
  groupable?: boolean;
  filterable?: boolean;
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
    ],
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
    ],
  },
};

export function getEntityDef(entity: ReportEntity): EntityDef {
  return ENTITY_REGISTRY[entity];
}

export function getFieldDef(entity: ReportEntity, key: string): FieldDef | undefined {
  return ENTITY_REGISTRY[entity].fields.find((f) => f.key === key);
}

export type DateFilterOp = "last_7_days" | "last_30_days" | "last_90_days" | "this_month" | "all_time";

export type CustomReportFilter =
  | { field: string; kind: "owner"; value: string } // value is a userId, or "unowned"
  | { field: string; kind: "enum" | "string" | "boolean"; value: string }
  | { field: string; kind: "date"; op: DateFilterOp };

export const DATE_FILTER_LABELS: Record<DateFilterOp, string> = {
  last_7_days: "Last 7 days",
  last_30_days: "Last 30 days",
  last_90_days: "Last 90 days",
  this_month: "This month",
  all_time: "All time",
};

export function dateFilterToRange(op: DateFilterOp): { gte: Date } | undefined {
  if (op === "all_time") return undefined;
  const now = new Date();
  if (op === "this_month") {
    return { gte: new Date(now.getFullYear(), now.getMonth(), 1) };
  }
  const days = op === "last_7_days" ? 7 : op === "last_30_days" ? 30 : 90;
  const gte = new Date(now);
  gte.setDate(gte.getDate() - days);
  return { gte };
}
