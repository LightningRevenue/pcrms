import { db } from "@/lib/db";

// Single source of truth for every subscription-tier limit in the app. Adding a new
// limitable resource or feature is exactly two steps, both local to the feature's own code:
//   1. Add an entry here (a `count`/`monthly` key needs `measure`; a `feature` key needs
//      nothing else).
//   2. Call `assertLimit(workspaceId, "your_new_key")` right before the action that should
//      be gated.
// Nothing else needs to change — the plan-management UI and the seed script both iterate
// this object, so a new key shows up there automatically.
//
// A `count` key measures a live total (e.g. "how many contacts exist right now"). A
// `monthly` key measures how many rows were created in the current calendar month. A
// `feature` key has no measurement at all — it's a pure on/off gate, checked without
// counting anything.
export type EntitlementType = "count" | "monthly" | "feature";

export type EntitlementDefinition = {
  key: string;
  label: string;
  type: EntitlementType;
  // Only present for "count"/"monthly" keys — resolves the current usage for a workspace.
  measure?: (workspaceId: string) => Promise<number>;
};

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Workspace members counts active WorkspaceMember rows plus not-yet-accepted, not-yet-expired
// invites — otherwise a workspace could send unlimited invites and only discover it's over
// the seat limit once people actually accept (see audit notes in SUBSCRIPTION_LIMITS_AUDIT.md).
async function countMembersAndPendingInvites(workspaceId: string) {
  const [members, invites] = await Promise.all([
    db.workspaceMember.count({ where: { workspaceId } }),
    db.workspaceInvite.count({ where: { workspaceId, acceptedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  return members + invites;
}

export const ENTITLEMENTS = {
  // ---- Countable resources ("max N") ----
  contacts_count: {
    key: "contacts_count",
    label: "Contacts",
    type: "count",
    measure: (workspaceId) => db.person.count({ where: { workspaceId, deletedAt: null } }),
  },
  companies_count: {
    key: "companies_count",
    label: "Companies",
    type: "count",
    measure: (workspaceId) => db.company.count({ where: { workspaceId, deletedAt: null } }),
  },
  deals_count: {
    key: "deals_count",
    label: "Deals",
    type: "count",
    measure: (workspaceId) => db.opportunity.count({ where: { workspaceId, deletedAt: null } }),
  },
  tasks_count: {
    key: "tasks_count",
    label: "Tasks",
    type: "count",
    measure: (workspaceId) => db.task.count({ where: { workspaceId } }),
  },
  notes_count: {
    key: "notes_count",
    label: "Notes",
    type: "count",
    measure: (workspaceId) => db.note.count({ where: { workspaceId } }),
  },
  campaigns_count: {
    key: "campaigns_count",
    label: "Campaigns",
    type: "count",
    measure: (workspaceId) => db.campaign.count({ where: { workspaceId } }),
  },
  sequences_count: {
    key: "sequences_count",
    label: "Sequences",
    type: "count",
    measure: (workspaceId) => db.sequence.count({ where: { workspaceId } }),
  },
  sequence_steps_count: {
    key: "sequence_steps_count",
    label: "Sequence steps (per sequence)",
    type: "count",
    // Whole-workspace total, not per-sequence — a finer per-sequence cap would need
    // assertLimit's caller to pass the sequence's own step count instead of relying on this.
    measure: (workspaceId) => db.sequenceStep.count({ where: { workspaceId } }),
  },
  sequence_enrollments_count: {
    key: "sequence_enrollments_count",
    label: "Sequence enrollments",
    type: "count",
    measure: (workspaceId) => db.sequenceEnrollment.count({ where: { workspaceId } }),
  },
  workflows_count: {
    key: "workflows_count",
    label: "Workflows",
    type: "count",
    measure: (workspaceId) => db.workflow.count({ where: { workspaceId } }),
  },
  playbooks_count: {
    key: "playbooks_count",
    label: "Playbooks",
    type: "count",
    measure: (workspaceId) => db.playbook.count({ where: { workspaceId } }),
  },
  custom_fields_count: {
    key: "custom_fields_count",
    label: "Custom field definitions",
    type: "count",
    measure: (workspaceId) => db.customFieldDefinition.count({ where: { workspaceId } }),
  },
  lists_count: {
    key: "lists_count",
    label: "Lists",
    type: "count",
    measure: (workspaceId) => db.list.count({ where: { workspaceId } }),
  },
  email_templates_count: {
    key: "email_templates_count",
    label: "Email templates",
    type: "count",
    measure: (workspaceId) => db.emailTemplate.count({ where: { workspaceId } }),
  },
  mailbox_accounts_count: {
    key: "mailbox_accounts_count",
    label: "Outreach inboxes",
    type: "count",
    measure: (workspaceId) => db.mailboxAccount.count({ where: { workspaceId } }),
  },
  members_count: {
    key: "members_count",
    label: "Workspace members",
    type: "count",
    measure: countMembersAndPendingInvites,
  },
  pipeline_stages_count: {
    key: "pipeline_stages_count",
    label: "Pipeline stages",
    type: "count",
    measure: (workspaceId) => db.pipelineStage.count({ where: { workspaceId } }),
  },

  // ---- Feature gates (on/off, no measurement) ----
  campaigns_feature: { key: "campaigns_feature", label: "Marketing campaigns", type: "feature" },
  sequences_feature: { key: "sequences_feature", label: "Sequences / drip automation", type: "feature" },
  workflows_feature: { key: "workflows_feature", label: "Workflows automation", type: "feature" },
  voice_calling_feature: { key: "voice_calling_feature", label: "Twilio voice calling", type: "feature" },
  custom_fields_feature: { key: "custom_fields_feature", label: "Custom fields", type: "feature" },
  csv_import_feature: { key: "csv_import_feature", label: "CSV import", type: "feature" },
  outreach_inboxes_feature: { key: "outreach_inboxes_feature", label: "Outreach inboxes (SMTP/IMAP)", type: "feature" },
  playbooks_feature: { key: "playbooks_feature", label: "Playbooks", type: "feature" },
  dashboards_feature: { key: "dashboards_feature", label: "Dashboards / analytics", type: "feature" },
  lists_feature: { key: "lists_feature", label: "Lists", type: "feature" },
  custom_objects_feature: { key: "custom_objects_feature", label: "Custom objects", type: "feature" },
  // Premium add-on: GDPR request tracking (Settings > GDPR) and unsubscribe enforcement on
  // every send path. Unlike the other feature gates above, this one should ship *disabled* by
  // default on existing plans (set an explicit PlanLimit row with value 0) rather than relying
  // on the "no row = enabled" default — see checkLimit's feature branch — since it's meant to
  // be sold separately, not silently on for everyone.
  gdpr_feature: { key: "gdpr_feature", label: "GDPR tracking & unsubscribe enforcement", type: "feature" },

  // ---- Monthly volume ("N per month") ----
  emails_sent_monthly: {
    key: "emails_sent_monthly",
    label: "Emails sent",
    type: "monthly",
    measure: (workspaceId) => db.email.count({ where: { workspaceId, direction: "sent", sentAt: { gte: startOfMonth() } } }),
  },
  calls_monthly: {
    key: "calls_monthly",
    label: "Calls placed",
    type: "monthly",
    measure: (workspaceId) => db.call.count({ where: { workspaceId, startedAt: { gte: startOfMonth() } } }),
  },
  import_rows_monthly: {
    key: "import_rows_monthly",
    label: "CSV rows imported",
    type: "monthly",
    measure: async (workspaceId) => {
      const batches = await db.importBatch.findMany({
        where: { workspaceId, createdAt: { gte: startOfMonth() } },
        select: { successRows: true, errorRows: true },
      });
      return batches.reduce((sum, b) => sum + b.successRows + b.errorRows, 0);
    },
  },
  email_verifications_monthly: {
    key: "email_verifications_monthly",
    label: "Email verifications",
    type: "monthly",
    // Counts Person.emailVerifiedAt timestamps this month — re-verifying the same contact
    // twice in one month counts twice, since emailVerifiedAt only holds the latest check.
    measure: (workspaceId) => db.person.count({ where: { workspaceId, emailVerifiedAt: { gte: startOfMonth() } } }),
  },
} as const satisfies Record<string, EntitlementDefinition>;

export type EntitlementKey = keyof typeof ENTITLEMENTS;

export class EntitlementLimitError extends Error {
  constructor(public entitlement: EntitlementKey, public limit: number, public current: number) {
    const def = ENTITLEMENTS[entitlement];
    super(
      def.type === "feature"
        ? `${def.label} isn't available on your current plan.`
        : `${def.label} limit reached (${current}/${limit}) — upgrade your plan to add more.`
    );
    this.name = "EntitlementLimitError";
  }
}

// A missing PlanLimit row for a (planId, key) pair means unlimited (count/monthly) or
// enabled (feature) — plans only need rows for entitlements they actually restrict.
async function getPlanLimitValue(workspaceId: string, key: EntitlementKey): Promise<number | null | undefined> {
  const workspace = await db.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { planId: true },
  });
  const row = await db.planLimit.findUnique({
    where: { planId_key: { planId: workspace.planId, key } },
  });
  return row ? row.value : undefined; // undefined = no row = unrestricted
}

export type LimitCheck = { allowed: boolean; current: number; limit: number | null };

// Read-only check — use when you want to show usage/limits in the UI without throwing.
export async function checkLimit(workspaceId: string, key: EntitlementKey): Promise<LimitCheck> {
  const def = ENTITLEMENTS[key];
  const planValue = await getPlanLimitValue(workspaceId, key);

  if (def.type === "feature") {
    // A PlanLimit row with value 0 disables the feature; any other row (or no row) enables it.
    return { allowed: planValue !== 0, current: 0, limit: null };
  }

  if (planValue === undefined || planValue === null) {
    return { allowed: true, current: 0, limit: null }; // unlimited
  }

  const current = def.measure ? await def.measure(workspaceId) : 0;
  return { allowed: current < planValue, current, limit: planValue };
}

// Throws EntitlementLimitError if the workspace is at/over its limit for this key, or if
// the feature is disabled on its plan. Call this immediately before the create/action it
// guards — see contacts.ts's createContact for the reference pattern.
export async function assertLimit(workspaceId: string, key: EntitlementKey): Promise<void> {
  const result = await checkLimit(workspaceId, key);
  if (!result.allowed) {
    throw new EntitlementLimitError(key, result.limit ?? 0, result.current);
  }
}

// For a "feature" key, at the top of a page component — checkLimit(key).allowed answers the
// same question but this name reads clearly at a page's gating check. Not meaningful for
// count/monthly keys (there's no fixed "does this page render at all" answer for those).
export async function hasFeatureAccess(workspaceId: string, key: EntitlementKey): Promise<boolean> {
  const result = await checkLimit(workspaceId, key);
  return result.allowed;
}
